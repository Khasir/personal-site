import { test, expect } from "@playwright/test";

test("every page has exactly one <title> tag", async ({ page }) => {
  // Regression: jekyll-seo-tag's {% seo %} already renders a <title>; a
  // manually-added one in head.html briefly created a duplicate.
  for (const url of ["/", "/posts/", "/notes/", "/interviews/", "/guestbook/", "/posts/hello-world/"]) {
    await page.goto(url);
    await expect(page.locator("title")).toHaveCount(1);
  }
});

test("external links open in a new tab with the arrow indicator; internal links don't", async ({ page }) => {
  await page.goto("/posts/hello-world/");

  const external = page.locator('a[href="https://example.com/"]');
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer");
  await expect(external).toHaveClass(/external-link/);

  const internal = page.locator(".site-nav a").first();
  await expect(internal).not.toHaveAttribute("target", "_blank");
  await expect(internal).not.toHaveClass(/external-link/);
});

test("hovering a footnote marker shows a tooltip with the note's text", async ({ page }) => {
  await page.goto("/posts/hello-world/");
  // The marker is a tiny (~8px) superscript, and its on-page position
  // shifts depending on how many comment highlights earlier tests have
  // added above it -- dispatching the event directly targets the
  // mouseenter handler itself rather than depending on precise hover
  // coordinates landing inside such a small target.
  await page.locator("a.footnote").first().dispatchEvent("mouseenter");
  const tooltip = page.locator(".footnote-tooltip");
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText("kramdown handles the numbering");
});

test.describe("internal link previews", () => {
  // Injects links into the homepage's intro copy (so the test doesn't depend
  // on what any post links to) and wires them the way encrypted-post.js does.
  async function addLinks(page, hrefs) {
    await page.goto("/");
    await page.evaluate((list) => {
      const container = document.querySelector(".entry-content");
      list.forEach((href, i) => {
        const a = document.createElement("a");
        a.href = href;
        a.id = "preview-link-" + i;
        a.textContent = "link " + i;
        container.appendChild(a);
      });
      window.wirePagePreviews(container);
    }, hrefs);
  }

  test("hovering a link to a post shows its title, subtitle and a one-line faded excerpt", async ({ page }) => {
    await addLinks(page, ["/posts/hello-world/"]);

    const target = await (await page.request.get("/posts/hello-world/")).text();
    const title = target.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)[1].trim();

    await page.locator("#preview-link-0").dispatchEvent("mouseenter");
    const tooltip = page.locator(".page-preview-tooltip");
    await expect(tooltip).toBeVisible();
    await expect(tooltip.locator(".page-preview-title")).toContainText(title);
    await expect(tooltip.locator(".page-preview-excerpt")).not.toBeEmpty();

    // Excerpt is a single nowrap line, faded out by a mask.
    const excerpt = tooltip.locator(".page-preview-excerpt");
    await expect(excerpt).toHaveCSS("white-space", "nowrap");
    await expect(excerpt).toHaveCSS("overflow", "hidden");

    await page.locator("#preview-link-0").dispatchEvent("mouseleave");
    await expect(tooltip).toBeHidden();
  });

  test("links to list pages, images and feeds get no preview", async ({ page }) => {
    await addLinks(page, ["/posts/", "/feed.xml", "/content/images/sample-center.svg"]);

    for (const id of ["#preview-link-0", "#preview-link-1", "#preview-link-2"]) {
      await page.locator(id).dispatchEvent("mouseenter");
      await page.waitForTimeout(200);
      await expect(page.locator(".page-preview-tooltip")).toHaveCount(0);
    }
  });
});

test("clicking an image opens the fullscreen lightbox", async ({ page }) => {
  await page.goto("/posts/hello-world/");
  await page.locator("a[data-lightbox]").first().click();
  const overlay = page.locator(".lightbox-overlay");
  await expect(overlay).toBeVisible();
  await expect(overlay.locator("img")).toHaveAttribute("src", /sample-center\.svg/);
});

test.describe("blockquote attribution", () => {
  test("a marked attribution paragraph right-aligns; the quote body doesn't", async ({ page }) => {
    await page.goto("/posts/");
    const paragraphs = page.locator("blockquote p");
    await expect(paragraphs.first()).not.toHaveCSS("text-align", "right");
    await expect(paragraphs.last()).toHaveCSS("text-align", "right");
  });

  test("an unattributed single-paragraph quote never right-aligns", async ({ page }) => {
    await page.goto("/posts/hello-world/");
    const quote = page.locator(".entry-content blockquote p");
    await expect(quote).not.toHaveCSS("text-align", "right");
  });

  test("a multi-paragraph quote with no .attribution marker stays left-aligned throughout", async ({ page }) => {
    // Regression: the right-align rule used to infer "attribution" from
    // structure (last paragraph of a multi-paragraph quote), which would
    // misfire on a genuine multi-paragraph quote with no attribution at
    // all. It's now opt-in via an explicit {: .attribution} marker.
    await page.goto("/");
    await page.evaluate(() => {
      document.body.insertAdjacentHTML(
        "beforeend",
        '<blockquote id="test-unattributed-bq"><p>Paragraph one.</p><p>Paragraph two, no attribution class.</p></blockquote>'
      );
    });
    const paragraphs = page.locator("#test-unattributed-bq p");
    await expect(paragraphs.first()).not.toHaveCSS("text-align", "right");
    await expect(paragraphs.last()).not.toHaveCSS("text-align", "right");
  });
});
