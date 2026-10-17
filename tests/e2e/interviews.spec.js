import { test, expect } from "@playwright/test";
import { HIDDEN_INTERVIEW_FIXTURE, INTERVIEW_FIXTURE, INTERVIEW_TAG } from "./fixtures/interview-fixture-constants.js";

const FEED_URL = "/interviews/feed.xml";
const feedAutodiscovery = (page) => page.locator(`head link[rel="alternate"][href="${FEED_URL}"]`);

test.describe("interviews: navigation", () => {
  test("header and footer link to interviews, after posts", async ({ page }) => {
    await page.goto("/");
    for (const nav of [page.locator(".site-header .site-nav"), page.locator(".site-footer .site-nav")]) {
      const link = nav.locator('a[href="/interviews/"]');
      await expect(link).toHaveText("interviews");
      const labels = await nav.locator(":scope > a").allInnerTexts();
      expect(labels.indexOf("interviews")).toBe(labels.indexOf("posts") + 1);
    }
  });

  test("the interviews feed is not linked from the footer (or the header); the main feed still is", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(`.site-footer a[href="${FEED_URL}"]`)).toHaveCount(0);
    await expect(page.locator(`.site-header a[href="${FEED_URL}"]`)).toHaveCount(0);
    await expect(page.locator('.site-footer a[href="/feed.xml"]')).toHaveText("rss");
  });

  test("the interviews link is marked current on its own page only", async ({ page }) => {
    await page.goto("/interviews/");
    await expect(page.locator('.site-header .site-nav a[href="/interviews/"]')).toHaveAttribute("aria-current", "page");
    await page.goto("/posts/");
    await expect(page.locator('.site-header .site-nav a[href="/interviews/"]')).not.toHaveAttribute("aria-current", "page");
  });
});

test.describe("interviews: list page", () => {
  test("lists non-hidden interviews with their summary and date, and links the feed", async ({ page }) => {
    await page.goto("/interviews/");
    await expect(page.locator("h1")).toHaveText(/interviews/i);

    const item = page.locator(".entry-list li", { hasText: INTERVIEW_FIXTURE.title });
    await expect(item.locator(`a[href="${INTERVIEW_FIXTURE.url}"]`)).toHaveText(INTERVIEW_FIXTURE.title);
    await expect(item.locator(".entry-summary")).toHaveText(INTERVIEW_FIXTURE.linkPreview);
    await expect(item.locator("time")).toContainText("Jan 2, 2024");

    await expect(page.locator(`.entry-list a[href="${HIDDEN_INTERVIEW_FIXTURE.url}"]`)).toHaveCount(0);

    // Linked on the page itself (in the page body, not the nav chrome)...
    await expect(page.locator(`main a[href="${FEED_URL}"]`)).toBeVisible();
    // ...and advertised to feed readers.
    await expect(feedAutodiscovery(page)).toHaveCount(1);
  });

  test("interviews don't appear on the homepage or the posts list", async ({ page }) => {
    for (const url of ["/", "/posts/"]) {
      await page.goto(url);
      await expect(page.locator(`a[href="${INTERVIEW_FIXTURE.url}"]`)).toHaveCount(0);
      await expect(page.getByText(INTERVIEW_FIXTURE.title)).toHaveCount(0);
    }
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /interview/i })).toHaveCount(0);
    await expect(feedAutodiscovery(page)).toHaveCount(0);
  });
});

test.describe("interviews: entry pages", () => {
  test("an interview renders like a post/note, labelled 'interview'", async ({ page }) => {
    await page.goto(INTERVIEW_FIXTURE.url);
    await expect(page.locator(".entry-kind")).toHaveText("interview");
    await expect(page.locator(".entry-heading h1")).toHaveText(INTERVIEW_FIXTURE.title);
    await expect(page.locator(".entry-subtitle")).toHaveText(INTERVIEW_FIXTURE.subtitle);
    await expect(page.locator(".entry-content")).toContainText(INTERVIEW_FIXTURE.body);
    await expect(page.locator(".entry-meta time").first()).toContainText("Jan 2, 2024");
    await expect(page.locator(`.entry-tags a.tag[href="/tags/${INTERVIEW_TAG}/"]`)).toBeVisible();
    await expect(feedAutodiscovery(page)).toHaveCount(1);
  });

  test("a hidden interview is still reachable by direct link", async ({ page }) => {
    const response = await page.goto(HIDDEN_INTERVIEW_FIXTURE.url);
    expect(response.status()).toBe(200);
    await expect(page.locator(".entry-heading h1")).toHaveText(HIDDEN_INTERVIEW_FIXTURE.title);
  });

  test("posts and notes keep their own labels", async ({ page }) => {
    await page.goto("/posts/hello-world/");
    await expect(page.locator(".entry-kind")).toHaveText("post");
    await expect(feedAutodiscovery(page)).toHaveCount(0);
  });
});

test.describe("interviews: tag pages", () => {
  test("a tag page lists non-hidden interviews labelled 'interview'", async ({ page }) => {
    await page.goto(`/tags/${INTERVIEW_TAG}/`);
    const item = page.locator(".entry-list li", { hasText: INTERVIEW_FIXTURE.title });
    await expect(item.locator(".entry-kind")).toHaveText("interview");
    await expect(item.locator(`a[href="${INTERVIEW_FIXTURE.url}"]`)).toBeVisible();
    await expect(page.locator(`.entry-list a[href="${HIDDEN_INTERVIEW_FIXTURE.url}"]`)).toHaveCount(0);
  });
});

test.describe("interviews: feed", () => {
  test("has its own Atom feed of non-hidden interviews", async ({ request }) => {
    const response = await request.get(FEED_URL);
    expect(response.ok()).toBe(true);
    const xml = await response.text();

    expect(xml).toContain('rel="self"');
    expect(xml).toContain(FEED_URL);
    expect(xml).toMatch(/<title type="html">[^<]*Interviews<\/title>/);
    expect(xml).toContain(`<title type="html">${INTERVIEW_FIXTURE.title}</title>`);
    expect(xml).toContain(INTERVIEW_FIXTURE.url);
    expect(xml).toContain(INTERVIEW_FIXTURE.linkPreview);
    // Excerpt-only (the _config.yml default for interviews): the summary is
    // there, the full body isn't.
    expect(xml).not.toContain("<content");
    expect(xml).not.toContain(INTERVIEW_FIXTURE.body);
    // Dated from post_date, not the build time.
    expect(xml).toContain("<published>2024-01-02");
    expect(xml).toContain(`<category term="${INTERVIEW_TAG}" />`);

    expect(xml).not.toContain(HIDDEN_INTERVIEW_FIXTURE.title);
  });

  test("the main feed doesn't include interviews", async ({ request }) => {
    const xml = await (await request.get("/feed.xml")).text();
    expect(xml).not.toContain(INTERVIEW_FIXTURE.title);
    expect(xml).not.toContain("/interviews/");
  });
});
