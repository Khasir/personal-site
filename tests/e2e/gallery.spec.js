import { test, expect } from "@playwright/test";
import { GALLERY_FIXTURE_URL } from "./fixtures/gallery-fixture-constants.js";

test.describe("gallery", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(GALLERY_FIXTURE_URL);
  });

  test("renders square tiles with only the gallery caption visible", async ({ page }) => {
    const gallery = page.locator("figure.gallery");
    const tiles = gallery.locator(".gallery-grid .fig-link");
    await expect(tiles).toHaveCount(3);

    // Source images are 2:1, so this checks object-fit cropping, and that
    // align="right" width="100px" on the second figure is ignored.
    for (const tile of await tiles.all()) {
      const box = await tile.boundingBox();
      expect(Math.abs(box.width - box.height)).toBeLessThan(2);
    }
    const [a, b] = await Promise.all([tiles.nth(0).boundingBox(), tiles.nth(1).boundingBox()]);
    expect(Math.abs(a.width - b.width)).toBeLessThan(2);
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);

    await expect(gallery.locator(".fig figcaption").first()).toBeHidden();
    const caption = gallery.locator(":scope > figcaption");
    await expect(caption).toBeVisible();
    await expect(caption.locator("em")).toHaveText("test");
    // Footnote in the gallery caption merges into the post's footnotes.
    await expect(caption.locator("sup a.footnote")).toHaveCount(1);
    await expect(page.locator(".footnotes")).toContainText("A footnote on the gallery caption.");
  });

  test("lightbox steps through the gallery with buttons and keys, wrapping", async ({ page }) => {
    const tiles = page.locator("figure.gallery .fig-link");
    const overlay = page.locator(".lightbox-overlay");
    const counter = overlay.locator(".lightbox-counter");
    const caption = overlay.locator(".lightbox-caption");

    await tiles.nth(1).click();
    await expect(overlay).toBeVisible();
    await expect(counter).toHaveText("2 / 3");
    await expect(caption.locator("em")).toHaveText("green");
    await expect(overlay.locator("img")).toHaveAttribute("src", await tiles.nth(1).getAttribute("href"));

    // Clicking the arrows must not count as a click-outside-to-close.
    await overlay.locator(".lightbox-next").click();
    await expect(overlay).toBeVisible();
    await expect(counter).toHaveText("3 / 3");
    await expect(caption).toHaveText("The blue one");

    await page.keyboard.press("ArrowRight");
    await expect(counter).toHaveText("1 / 3");
    await page.keyboard.press("ArrowLeft");
    await expect(counter).toHaveText("3 / 3");
    await overlay.locator(".lightbox-prev").click();
    await expect(counter).toHaveText("2 / 3");

    await page.keyboard.press("Escape");
    await expect(overlay).toBeHidden();
  });

  test("a standalone figure has no prev/next or counter", async ({ page }) => {
    await page.locator("article .fig:not(.gallery .fig) .fig-link").click();
    const overlay = page.locator(".lightbox-overlay");
    await expect(overlay).toBeVisible();
    await expect(overlay.locator(".lightbox-caption")).toHaveText("A standalone figure");
    await expect(overlay.locator(".lightbox-prev")).toBeHidden();
    await expect(overlay.locator(".lightbox-next")).toBeHidden();
    await expect(overlay.locator(".lightbox-counter")).toBeHidden();

    // Arrow keys do nothing for a single image.
    await page.keyboard.press("ArrowRight");
    await expect(overlay.locator(".lightbox-caption")).toHaveText("A standalone figure");
  });

  test("uses two columns on narrow screens without overflowing", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(GALLERY_FIXTURE_URL);
    const tiles = page.locator("figure.gallery .fig-link");
    const [a, b, c] = await Promise.all([0, 1, 2].map((i) => tiles.nth(i).boundingBox()));
    expect(Math.abs(a.y - b.y)).toBeLessThan(2);
    expect(c.y).toBeGreaterThan(a.y + a.height - 1);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow).toBe(false);
  });
});
