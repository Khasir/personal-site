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
    await expect(content.locator(":scope > p").first().locator("strong")).toHaveText("bold");

    // Regression: external-links.js only wires up links present at page
    // load, so a link inside content decrypted (and inserted) later needs
    // to be wired up explicitly -- see window.wireExternalLinks.
    const link = content.locator("a");
    await expect(link).toHaveAttribute("href", "https://example.com");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveClass(/external-link/);
  });

  test("HTML comments in the decrypted body aren't rendered", async ({ page }) => {
    await unlock(page);
    const content = page.locator("[data-encrypted-content]");
    await expect(content).toContainText("after the comments.");
    await expect(content).not.toContainText("hidden note");
    await expect(content).not.toContainText("<!--");
    await expect(content).not.toContainText("spanning paragraphs");
    // The comment-only paragraph leaves no empty <p> behind.
    await expect(content.locator("p:empty")).toHaveCount(0);
  });

  test("bullet points in the decrypted body render as a list", async ({ page }) => {
    await unlock(page);
    const content = page.locator("[data-encrypted-content]");
    // The list interrupts its lead-in line without a blank line between.
    await expect(content.locator("p", { hasText: "a list:" })).toHaveCount(1);
    const items = content.locator(":scope > ul > li");
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toHaveText("first item");
    await expect(items.nth(1).locator("strong")).toHaveText("item");
    // An unmarked line right after an item continues that item.
    await expect(items.nth(2)).toContainText("third item");
    await expect(items.nth(2)).toContainText("continued");
    await expect(content).not.toContainText("- first");
  });

  test("numbered and nested lists in the decrypted body render", async ({ page }) => {
    await unlock(page);
    const content = page.locator("[data-encrypted-content]");
    const lists = content.locator(":scope > ol");
    await expect(lists).toHaveCount(2);

    const steps = lists.nth(0).locator(":scope > li");
    await expect(steps).toHaveCount(3);
    await expect(lists.nth(0)).not.toHaveAttribute("start");
    // Deeper indent nests: a bullet list under step two, and a numbered
    // list under that bullet.
    const nested = steps.nth(1).locator(":scope > ul > li");
    await expect(nested).toHaveCount(1);
    await expect(nested.locator(":scope > ol > li")).toHaveText("deep step");
    await expect(steps.nth(2)).toHaveText("step three");

    // A numbered list keeps its first number.
    await expect(lists.nth(1)).toHaveAttribute("start", "4");
    await expect(lists.nth(1).locator(":scope > li")).toHaveCount(2);

    // A numbered line not starting at 1 can't interrupt a paragraph.
    await expect(content.locator(":scope > p", { hasText: "2024. not a list" })).toHaveCount(1);
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
