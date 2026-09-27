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

  test("correct password reveals the decrypted content", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await page.locator("[data-encrypted-password]").fill(FIXTURE_PASSWORD);
    await page.locator("[data-encrypted-form] button[type=submit]").click();

    const content = page.locator("[data-encrypted-content]");
    await expect(content).toBeVisible();
    await expect(content).toContainText("the secret content");
    await expect(content.locator(":scope > p").first().locator("strong")).toHaveText("bold");

    // Regression: external-links.js only wires up links present at page
    // load, so a link inside content decrypted (and inserted) later needs
    // to be wired up explicitly -- see window.wireExternalLinks.
    const link = content.locator('a[href="https://example.com"]');
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveClass(/external-link/);
  });

  test("the body is rendered by kramdown with the site's settings", async ({ page }) => {
    await unlock(page);
    const content = page.locator("[data-encrypted-content]");
    await expect(content.locator("h2#a-heading")).toHaveText("A heading");
    // kramdown's typographic conversions (smart quotes, -- to an en dash).
    await expect(content).toContainText("“Smart quotes” – a footnote");
    await expect(content.locator("p code")).toHaveText("inline code");
    await expect(content.locator("pre code")).toContainText("const answer = 42;");
    await expect(content.locator("blockquote p.attribution")).toHaveText("— Someone");
    await expect(content.locator("ol > li ul > li")).toHaveText("nested bullet");
    await expect(content.locator("sup a.footnote")).toHaveAttribute("href", "#fn:1");
    await expect(content.locator(".footnotes li")).toContainText("The footnote text.");
  });

  test("HTML comments in the decrypted body aren't shown", async ({ page }) => {
    await unlock(page);
    const content = page.locator("[data-encrypted-content]");
    await expect(content).toContainText("A heading");
    await expect(content).not.toContainText("hidden note");
    await expect(content).not.toContainText("spanning paragraphs");
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
