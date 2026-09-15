import { test, expect } from "@playwright/test";
import { selectText, uniqueTag, fakeIp } from "./helpers.js";
import { FIXTURE_PASSWORD, FIXTURE_URL } from "./fixtures/encrypted-fixture-constants.js";

async function unlock(page) {
  await page.goto(FIXTURE_URL);
  await page.locator("[data-encrypted-password]").fill(FIXTURE_PASSWORD);
  await page.locator("[data-encrypted-form] button[type=submit]").click();
  await expect(page.locator("[data-encrypted-content]")).toBeVisible();
}

test.describe("encrypted post", () => {
  test.beforeEach(async ({ page }) => {
    await page.setExtraHTTPHeaders({ "CF-Connecting-IP": fakeIp() });
  });

  test("shows title/date/preview but never the plaintext before unlocking", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await expect(page.locator("h1")).toHaveText(/e2e encrypted fixture/i);
    const html = await page.content();
    expect(html).not.toContain("the secret content");
    await expect(page.locator("[data-encrypted-content]")).toBeHidden();
  });

  test("wrong password shows an error and reveals nothing", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.locator("[data-encrypted-password]").fill("wrong password");
    await page.locator("[data-encrypted-form] button[type=submit]").click();
    await expect(page.locator("[data-encrypted-error]")).toBeVisible();
    await expect(page.locator("[data-encrypted-content]")).toBeHidden();
  });

  test("correct password reveals the decrypted content, rendered through the markdown subset", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.locator("[data-encrypted-password]").fill(FIXTURE_PASSWORD);
    await page.locator("[data-encrypted-form] button[type=submit]").click();

    const content = page.locator("[data-encrypted-content]");
    await expect(content).toBeVisible();
    await expect(content).toContainText("the secret content");
    await expect(content.locator("strong")).toHaveText("bold");

    // Regression: external-links.js only wires up links present at page
    // load, so a link inside content decrypted (and inserted) later needs
    // to be wired up explicitly -- see window.wireExternalLinks.
    const link = content.locator("a");
    await expect(link).toHaveAttribute("href", "https://example.com");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveClass(/external-link/);
  });

  test("a comment posted after unlocking is still shown after reloading and unlocking again", async ({ page }) => {
    // Regression: comments.js's initial fetch/render runs right after page
    // load, before the reader has unlocked anything -- .entry-content is
    // still empty then, so every comment silently fails to anchor and
    // never gets a second chance to render once the real text appears.
    // See window.refreshCommentHighlights in comments.js.
    await unlock(page);
    const tag = uniqueTag();

    await selectText(page, "the secret content");
    await page.locator("[data-comment-trigger]").click();
    await page.locator("#comment-name").fill(`Encrypted-${tag}`);
    await page.locator("#comment-body").fill(`comment ${tag}`);
    const responsePromise = page.waitForResponse(
      (res) => res.url().includes("/api/comments") && res.request().method() === "POST"
    );
    await page.locator("[data-comment-form]").locator('button[type="submit"]').click();
    const created = await (await responsePromise).json();
    await expect(page.locator("[data-comment-form-status]")).toHaveText(/thank you/i);

    await page.reload();
    await unlock(page);

    const mark = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(mark).toHaveText("the secret content");
  });
});
