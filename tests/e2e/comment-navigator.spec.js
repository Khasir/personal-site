import { test, expect } from "@playwright/test";
import { selectText, uniqueTag, fakeIp } from "./helpers.js";

const POST_URL = "/posts/hello-world/";

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
  await responsePromise;
  await expect(page.locator("[data-comment-form-dialog]")).toBeHidden();
}

// Posts one comment per phrase (all within hello-world's body text) and
// returns the unique tag used in the comment bodies.
async function seedComments(page, phrases) {
  const tag = uniqueTag();
  await page.goto(POST_URL);
  for (const [i, phrase] of phrases.entries()) {
    await selectText(page, phrase);
    await submitComment(page, { name: `Ada-${tag}`, body: `Comment ${i} ${tag}` });
  }
  await page.reload();
  return tag;
}

const nav = (page) => page.locator("[data-comment-nav]");
const label = (page) => page.locator("[data-comment-nav-label]");
const next = (page) => page.locator("[data-comment-nav-next]");
const prev = (page) => page.locator("[data-comment-nav-prev]");
const thread = (page) => page.locator("[data-comment-thread-popover]");

test("is hidden when the page has no comments", async ({ page }) => {
  await page.goto("/posts/");
  await expect(nav(page)).toBeHidden();
});

test("is not shown on the homepage", async ({ page }) => {
  await page.goto("/");
  await expect(nav(page)).toBeHidden();
});

test("is a fixed 160px wide", async ({ page }) => {
  await seedComments(page, ["no account required"]);
  expect((await nav(page).boundingBox()).width).toBe(160);
});

test("clicking the Comments label minimizes it to a speech bubble and back", async ({ page }) => {
  await seedComments(page, ["no account required"]);
  const toggle = page.locator("[data-comment-nav-toggle]");
  await toggle.click();
  await expect(toggle).toHaveText("📜");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(next(page)).toBeHidden();
  await expect(label(page)).toBeHidden();

  await page.reload(); // remembered
  await expect(toggle).toHaveText("📜");
  await expect(next(page)).toBeHidden();

  await toggle.click();
  await page.reload();
  await expect(toggle).toHaveText("Comments"); // expanded state is remembered too
  await expect(next(page)).toBeVisible();
});

test("steps in order when a newer thread's highlight overlaps an older one", async ({ page }) => {
  // The older, inner thread's first mark is "primary" to the newer, outer
  // comment; the label must still follow the navigator's own position.
  await seedComments(page, ["account required", "no account required"]);
  await next(page).click();
  await expect(label(page)).toHaveText("1 of 2");
  await next(page).click();
  await expect(label(page)).toHaveText("2 of 2");
  await next(page).click();
  await expect(label(page)).toHaveText("1 of 2");
  await prev(page).click();
  await expect(label(page)).toHaveText("2 of 2");
});

test("appears once a comment exists and walks threads with wrap-around", async ({ page }) => {
  await seedComments(page, ["no account required", "kramdown handles the numbering"]);

  await expect(nav(page)).toBeVisible();
  await expect(label(page)).toHaveText(/^– of \d+$/);

  await next(page).click();
  await expect(label(page)).toHaveText(/^1 of \d+$/);
  await expect(thread(page)).toBeVisible();

  const total = Number((await label(page).textContent()).match(/of (\d+)/)[1]);
  expect(total).toBeGreaterThanOrEqual(2);

  await prev(page).click(); // wraps 1 -> last
  await expect(label(page)).toHaveText(`${total} of ${total}`);
  await next(page).click(); // wraps last -> 1
  await expect(label(page)).toHaveText(`1 of ${total}`);
  await expect(thread(page)).toBeVisible();
});

test("Up from idle opens the last thread; closing the thread resets the label", async ({ page }) => {
  await seedComments(page, ["no account required"]);
  await prev(page).click();
  await expect(label(page)).toHaveText(/^\d+ of \d+$/);
  await page.locator("[data-comment-thread-close]").click();
  await expect(label(page)).toHaveText(/^– of \d+$/);
});

test("comments on the same text count as one thread", async ({ page }) => {
  const phrase = "no account required";
  await seedComments(page, [phrase]);
  await next(page).click();
  const before = Number((await label(page).textContent()).match(/of (\d+)/)[1]);

  await selectText(page, phrase);
  await submitComment(page, { name: "Bob", body: `Same spot ${uniqueTag()}` });
  await expect(label(page)).toHaveText(/^– of \d+$/);
  await next(page).click();
  await expect(label(page)).toHaveText(new RegExp(`of ${before}$`));
  await expect(thread(page).locator("li").nth(1)).toBeVisible();
});

test("clicking a highlight updates the label", async ({ page }) => {
  await seedComments(page, ["no account required"]);
  await page.locator("mark.comment-highlight").first().click();
  await expect(label(page)).toHaveText(/^\d+ of \d+$/);
});

test("the nav is tabbed to before the body's links", async ({ page }) => {
  await seedComments(page, ["no account required"]);
  const beforeContent = await page.evaluate(() => {
    const n = document.querySelector("[data-comment-nav]");
    const a = document.querySelector(".entry-content");
    return !!(n.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING);
  });
  expect(beforeContent).toBe(true);

  await next(page).focus();
  await page.keyboard.press("Enter");
  await expect(label(page)).toHaveText(/^1 of/);
});

test("desktop: sits in the right margin at the bottom of the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await seedComments(page, ["no account required"]);
  const box = await nav(page).boundingBox();
  const content = await page.locator(".entry-content").boundingBox();
  expect(box.x).toBeGreaterThan(content.x + content.width);
  expect(box.y + box.height).toBeGreaterThan(700);
});

test("mobile: opening a thread doesn't widen the page or move the nav", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await seedComments(page, ["no account required"]);
  const before = await nav(page).boundingBox();
  await next(page).click();
  await expect(thread(page)).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  expect((await nav(page).boundingBox()).x).toBe(before.x);
});

test("mobile: floats at the bottom right without overflowing", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await seedComments(page, ["no account required"]);
  const box = await nav(page).boundingBox();
  expect(box.x + box.width).toBeGreaterThan(375 - 40);
  expect(box.x + box.width).toBeLessThanOrEqual(375);
  expect(box.y + box.height).toBeGreaterThan(600);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
