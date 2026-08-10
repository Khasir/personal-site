import { test, expect } from "@playwright/test";
import { selectText, selectAcross, uniqueTag, fakeIp } from "./helpers.js";

const POST_URL = "/posts/hello-world/";

// Each test gets its own fake client IP so the shared rate limiter (5
// writes/60s) doesn't trip between unrelated tests -- see fakeIp() in
// helpers.js for why this is safe to do from a test.
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
  // hideForm() runs on a ~900ms delay after success; the mouseup handler
  // bails out early while the dialog is still open, so a follow-up
  // selection in the same test would silently do nothing without this.
  await expect(page.locator("[data-comment-form-dialog]")).toBeHidden();
  return created;
}

test.describe("selecting text", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(POST_URL);
  });

  test("a normal in-paragraph selection shows the Comment popover", async ({ page }) => {
    await selectText(page, "no account required");
    await expect(page.locator("[data-comment-popover]")).toBeVisible();
  });

  test("a selection crossing a figure does not show the popover", async ({ page }) => {
    // Regression: this exact span (paragraph -> figure -> paragraph) used to
    // get wrapped in a single <mark>, which is invalid around block content
    // and broke the layout.
    await selectAcross(page, "right-aligned image, with text wrapping to its left", "Same idea, mirrored");
    await expect(page.locator("[data-comment-popover]")).toBeHidden();
  });

  test("a selection crossing two footnotes does not show the popover", async ({ page }) => {
    // Regression: same failure mode as the figure case, but with two
    // footnote <li>s nested inside a shared <ol>.
    await selectAcross(page, "kramdown handles the numbering", "A second footnote");
    await expect(page.locator("[data-comment-popover]")).toBeHidden();
  });

  test("a selection within a single footnote still shows the popover", async ({ page }) => {
    await selectText(page, "kramdown handles the numbering");
    await expect(page.locator("[data-comment-popover]")).toBeVisible();
  });
});

test.describe("posting a comment", () => {
  test("renders a highlight that survives a reload", async ({ page }) => {
    await page.goto(POST_URL);
    const tag = uniqueTag();
    await selectText(page, "no account required");
    const created = await submitComment(page, { name: `Ada-${tag}`, body: `Great point! ${tag}` });

    const mark = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(mark).toHaveText("no account required");

    await page.reload();
    const markAfterReload = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(markAfterReload).toHaveText("no account required");
  });

  test("anchors to the selected word, not an earlier occurrence containing it as a substring", async ({ page }) => {
    // Regression: the server was trimming prefix/suffix, which strips the
    // whitespace right next to the selection. That broke the exact
    // prefix+quote+suffix match (missing the space it needs), falling back
    // to a bare search for "image" -- which matched inside "images" in the
    // first paragraph ("...make sure images, footnotes...") instead of the
    // actual selected word in "Here's a centered image with a caption:".
    // "image" alone is ambiguous for a substring-based test helper too --
    // it would just as happily match inside "images" in paragraph one. Use
    // a two-word phrase that's unique in the document so the test reliably
    // targets the same paragraph the original bug report did, while still
    // exercising the same prefix/suffix mechanism (a single word would
    // exercise it identically; this just removes the ambiguity from the
    // test itself).
    await page.goto(POST_URL);
    const tag = uniqueTag();
    await selectText(page, "centered image");
    const created = await submitComment(page, { name: `Word-${tag}`, body: `word ${tag}` });

    const mark = page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`);
    await expect(mark).toHaveText("centered image");
    const paragraphText = await mark.locator("xpath=ancestor::p[1]").textContent();
    expect(paragraphText).toContain("Here");
    expect(paragraphText).not.toContain("make sure images");
  });

  test("shows the honeypot rejection as an error, not a success", async ({ page }) => {
    await page.goto(POST_URL);
    await selectText(page, "no account required");
    await page.locator("[data-comment-trigger]").click();
    await page.locator("#comment-name").fill("Bot");
    await page.locator("#comment-body").fill("spam");
    await page.locator("#comment-website").fill("http://spam.example");
    await page.locator("[data-comment-form]").locator('button[type="submit"]').click();
    await expect(page.locator("[data-comment-form-status]")).toHaveAttribute("data-state", "error");
  });
});

test.describe("overlapping comments", () => {
  test("render as flat, non-nested marks and a click shows every covering comment", async ({ page }) => {
    await page.goto(POST_URL);
    const tag = uniqueTag();

    // A broad anchor...
    await selectText(page, "This is the first post on the site, mostly here to make sure images");
    const first = await submitComment(page, { name: `Wide-${tag}`, body: `wide ${tag}` });

    // ...and a narrower one fully inside it, so their ranges overlap.
    await selectText(page, "mostly here to make sure");
    const second = await submitComment(page, { name: `Narrow-${tag}`, body: `narrow ${tag}` });

    const article = page.locator(".entry-content");
    await expect(article.locator("mark mark")).toHaveCount(0);

    const overlapSegment = article.locator(
      `mark.comment-highlight[data-comment-ids*="${first.id}"][data-comment-ids*="${second.id}"]`
    );
    await expect(overlapSegment.first()).toBeVisible();
    await overlapSegment.first().click();

    const thread = page.locator("[data-comment-thread-popover]");
    await expect(thread).toBeVisible();
    await expect(thread).toContainText(`wide ${tag}`);
    await expect(thread).toContainText(`narrow ${tag}`);
  });

  test("hovering any fragment of a comment highlights its full range as one block", async ({ page }) => {
    // A comment whose own anchor is broad, plus a second, more recent one
    // covering only a middle slice of it, splits the first comment's
    // rendering into three segments: [wide-only][overlap][wide-only].
    // Hovering *either* wide-only fragment should light up all three,
    // joining back into the wide comment's full original quote -- not
    // just the fragment actually under the cursor.
    await page.goto(POST_URL);
    const tag = uniqueTag();

    const wideQuote = "This is the first post on the site, mostly here to make sure images";
    await selectText(page, wideQuote);
    const wide = await submitComment(page, { name: `Wide2-${tag}`, body: `wide2 ${tag}` });

    // Posted after the first, so it becomes primary wherever it overlaps.
    await selectText(page, "mostly here to make sure");
    await submitComment(page, { name: `Narrow2-${tag}`, body: `narrow2 ${tag}` });

    // The leading fragment, where only the wide comment is primary.
    const leadingFragment = page.locator(
      `mark.comment-highlight[data-primary-comment-id="${wide.id}"]`
    ).first();
    // dispatchEvent rather than hover(): comments.js listens via
    // delegation on "mouseover", and a direct dispatch is more reliable
    // here than depending on precise hover coordinates.
    await leadingFragment.dispatchEvent("mouseover", { bubbles: true });

    const hoveredText = await page.locator("mark.comment-highlight.is-hovered").allTextContents();
    expect(hoveredText.join("")).toBe(wideQuote);
  });
});

test.describe("replying from a thread", () => {
  test("pre-fills the form with the primary comment's quote", async ({ page }) => {
    await page.goto(POST_URL);
    const tag = uniqueTag();

    await selectText(page, "no account required");
    await submitComment(page, { name: `Original-${tag}`, body: `original ${tag}` });

    const mark = page.locator('mark.comment-highlight', { hasText: "no account required" }).last();
    await mark.click();
    await page.locator("[data-comment-thread-reply]").click();

    await expect(page.locator("[data-comment-form-dialog]")).toBeVisible();
    await expect(page.locator("[data-comment-form-quote]")).toHaveText("no account required");
  });
});
