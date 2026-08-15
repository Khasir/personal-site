import { test, expect } from "@playwright/test";
import { selectText, uniqueTag, fakeIp } from "./helpers.js";

// Comments used to only work on individual post/note pages. Homepage,
// /posts/, and /notes/ now wrap their intro copy in .entry-content too, so
// the same select-to-comment mechanism should work there against that copy.

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": fakeIp() });
});

async function submitComment(page, { name, body }) {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/comments") && res.request().method() === "POST"
  );
  await page.locator("[data-comment-trigger]").click();
  await page.locator("#comment-name").fill(name);
  await page.locator("#comment-body").fill(body);
  await page.locator("[data-comment-form]").locator('button[type="submit"]').click();
  const response = await responsePromise;
  const created = await response.json();
  await expect(page.locator("[data-comment-form-status]")).toHaveText(/thank you/i);
  return created;
}

test.describe("homepage", () => {
  test("selecting text in the intro copy shows the Comment popover and posts a highlight that survives a reload", async ({ page }) => {
    await page.goto("/");
    const tag = uniqueTag();
    await selectText(page, "civic tech scene in Toronto");
    await expect(page.locator("[data-comment-popover]")).toBeVisible();

    const created = await submitComment(page, { name: `Home-${tag}`, body: `home comment ${tag}` });
    const mark = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(mark).toHaveText("civic tech scene in Toronto");

    await page.reload();
    const markAfterReload = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(markAfterReload).toHaveText("civic tech scene in Toronto");
  });

  test("scopes its thread to the homepage, not /posts/hello-world/", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("[data-comments]")).toHaveAttribute("data-post-slug", "/");
  });
});

test.describe("posts index", () => {
  test("selecting text in the intro quote shows the Comment popover and posts a highlight that survives a reload", async ({ page }) => {
    await page.goto("/posts/");
    const tag = uniqueTag();
    await selectText(page, "charming or tedious");
    await expect(page.locator("[data-comment-popover]")).toBeVisible();

    const created = await submitComment(page, { name: `Posts-${tag}`, body: `posts comment ${tag}` });
    const mark = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(mark).toHaveText("charming or tedious");

    await page.reload();
    const markAfterReload = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(markAfterReload).toHaveText("charming or tedious");
  });

  test("scopes its thread to /posts/, not the homepage", async ({ page }) => {
    await page.goto("/posts/");
    await expect(page.locator("[data-comments]")).toHaveAttribute("data-post-slug", "/posts/");
  });
});

test.describe("notes index", () => {
  test("wires up the comments UI, scoped to /notes/", async ({ page }) => {
    // notes.md currently has no intro copy, so there's nothing to select --
    // this just confirms the mechanism is wired up (script loaded, aside
    // present, correctly scoped) so it starts working the moment intro copy
    // is added.
    await page.goto("/notes/");
    await expect(page.locator("[data-comments]")).toHaveAttribute("data-post-slug", "/notes/");
    await expect(page.locator(".entry-content")).toHaveCount(1);
  });
});
