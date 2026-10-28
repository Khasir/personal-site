import { test, expect } from "@playwright/test";
import {
  AUDIO_DESCRIBED_FIXTURE,
  AUDIO_FILE_URL,
  AUDIO_PLAIN_FIXTURE,
  NO_AUDIO_FIXTURE,
  WAV_SECONDS,
} from "./fixtures/audio-fixture-constants.js";

// preload="none" means no duration until something loads the file, and
// seeking is silently ignored until the browser knows the range is seekable
// (the dev server may not serve byte ranges), so wait for the whole file.
async function loadMetadata(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const a = document.querySelector(".audio-player audio");
        const ready = () =>
          isFinite(a.duration) && a.seekable.length > 0 && a.seekable.end(0) >= a.duration - 0.1;
        const check = () => (ready() ? resolve() : setTimeout(check, 50));
        a.preload = "auto";
        a.load();
        check();
      })
  );
}

const currentTime = (page) => page.evaluate(() => document.querySelector(".audio-player audio").currentTime);

test.describe("audio player", () => {
  test("shows the label below the meta line with custom controls", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    const player = page.locator("[data-audio-player]");
    await expect(player).toContainText("Listen to this post:");
    const meta = await page.locator(".entry-meta").boundingBox();
    const box = await player.boundingBox();
    expect(box.y).toBeGreaterThan(meta.y + meta.height - 1);
    await expect(page.locator("audio.audio-element")).toBeHidden();
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Back 5 seconds" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Forward 5 seconds" })).toBeVisible();
    const dl = page.getByRole("link", { name: "Download audio" });
    await expect(dl).toHaveAttribute("href", AUDIO_FILE_URL);
    await expect(dl).toHaveAttribute("download", "");
  });

  test("no info button without audio_description", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    await expect(page.locator("[data-audio-info]")).toHaveCount(0);
  });

  test("no player without audio_file", async ({ page }) => {
    await page.goto(NO_AUDIO_FIXTURE.url);
    await expect(page.locator("[data-audio-player]")).toHaveCount(0);
  });

  test("back/forward 5s move and clamp", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    await loadMetadata(page);
    const fwd = page.getByRole("button", { name: "Forward 5 seconds" });
    const back = page.getByRole("button", { name: "Back 5 seconds" });
    await back.click();
    expect(await currentTime(page)).toBe(0);
    await fwd.click();
    expect(await currentTime(page)).toBeCloseTo(5, 1);
    await fwd.click();
    await back.click();
    expect(await currentTime(page)).toBeCloseTo(5, 1);
    for (let i = 0; i < 6; i++) await fwd.click();
    expect(await currentTime(page)).toBeLessThanOrEqual(WAV_SECONDS);
  });

  test("play/pause toggles state", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    const btn = page.locator("[data-audio-play]");
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(btn).toHaveAttribute("aria-label", "Pause");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await expect(btn).toHaveAttribute("aria-label", "Play");
  });

  test("volume button opens a slider that sets the volume and closes on Escape", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    const toggle = page.locator("[data-audio-volume-toggle]");
    const pop = page.locator(".audio-volume-pop");
    await expect(pop).toBeHidden();
    await toggle.click();
    await expect(pop).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.locator("[data-audio-volume]").fill("40");
    expect(await page.evaluate(() => document.querySelector(".audio-player audio").volume)).toBeCloseTo(0.4, 2);
    await page.keyboard.press("Escape");
    await expect(pop).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("opening the volume slider closes the description bubble", async ({ page }) => {
    await page.goto(AUDIO_DESCRIBED_FIXTURE.url);
    await page.locator("[data-audio-info]").click();
    await expect(page.locator(".audio-bubble")).toBeVisible();
    await page.locator("[data-audio-volume-toggle]").click();
    await expect(page.locator(".audio-volume-pop")).toBeVisible();
    await expect(page.locator(".audio-bubble")).toBeHidden();
  });

  test("description bubble renders markdown, closes on Escape and outside click", async ({ page }) => {
    await page.goto(AUDIO_DESCRIBED_FIXTURE.url);
    const info = page.locator("[data-audio-info]");
    const bubble = page.locator(".audio-bubble");
    await expect(bubble).toBeHidden();
    await expect(info).toHaveAttribute("aria-expanded", "false");
    await info.click();
    await expect(bubble).toBeVisible();
    await expect(info).toHaveAttribute("aria-expanded", "true");
    await expect(bubble.locator("em")).toHaveText("the author");
    await page.keyboard.press("Escape");
    await expect(bubble).toBeHidden();
    await expect(info).toBeFocused();
    await info.click();
    await expect(bubble).toBeVisible();
    await page.locator(".entry-content").click();
    await expect(bubble).toBeHidden();
  });

  test("no horizontal overflow at 375px, bubble stays on screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(AUDIO_DESCRIBED_FIXTURE.url);
    await page.locator("[data-audio-info]").click();
    const box = await page.locator(".audio-bubble").boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test("readable-font option outlines an audio button after it is clicked", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("a11y-font", "on"));
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    for (const sel of ["[data-audio-back]", "[data-audio-forward]", "[data-audio-play]", "[data-audio-volume-toggle]"]) {
      const btn = page.locator(sel);
      await expect(btn).not.toHaveCSS("outline-style", "solid");
      await btn.click();
      await expect(btn).toHaveCSS("outline-style", "solid");
      await expect(btn).toHaveCSS("outline-width", "2px");
    }
  });

  test("without the readable-font option a clicked audio button has no outline", async ({ page }) => {
    await page.goto(AUDIO_PLAIN_FIXTURE.url);
    const btn = page.locator("[data-audio-forward]");
    await btn.click();
    await expect(btn).not.toHaveCSS("outline-style", "solid");
  });
});
