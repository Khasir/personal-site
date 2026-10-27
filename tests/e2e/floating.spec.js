import { test, expect } from "@playwright/test";
import { FLOATING_FIXTURE_URL } from "./fixtures/floating-fixture-constants.js";

// Geometry of section `n` (0-based) in viewport coordinates.
function geometry(page, n) {
  return page.evaluate((i) => {
    const section = document.querySelectorAll(".floating-section")[i];
    const inner = section.querySelector(".floating-inner");
    const note = section.querySelector(".floating-note");
    const paras = section.querySelectorAll(":scope > p");
    const r = (el) => {
      const b = el.getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, height: b.height };
    };
    return {
      section: r(section),
      note: r(note),
      inner: r(inner),
      first: r(paras[0]),
      last: r(paras[paras.length - 1]),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, n);
}

// Scroll so that offset `y` (px from the top of section `n`) is at viewport y=`at`.
function scrollSectionTo(page, n, y, at) {
  return page.evaluate(
    ([i, offset, target]) => {
      const section = document.querySelectorAll(".floating-section")[i];
      const top = section.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: top + offset - target, behavior: "instant" });
    },
    [n, y, at],
  );
}

// Scroll so that the bottom of section `n` is at viewport y=`at`.
function scrollSectionEndTo(page, n, at) {
  return page.evaluate(
    ([i, target]) => {
      const section = document.querySelectorAll(".floating-section")[i];
      const bottom = section.getBoundingClientRect().bottom + window.scrollY;
      window.scrollTo({ top: bottom - target, behavior: "instant" });
    },
    [n, at],
  );
}

const near = (a, b, tol = 1.5) => expect(Math.abs(a - b)).toBeLessThan(tol);

test.describe("floating notes", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(FLOATING_FIXTURE_URL);
    await expect(page.locator(".floating-inner[data-floating-measured]")).toHaveCount(2);
  });

  test("renders with a single newline around the tags", async ({ page }) => {
    const content = page.locator(".entry-content");
    // The paragraphs either side of each tag are still ordinary paragraphs.
    await expect(content.locator(":scope > p", { hasText: "Intro paragraph before the first section." })).toHaveCount(1);
    await expect(content.locator(":scope > p", { hasText: "Between the sections." })).toHaveCount(1);
    await expect(content.locator(":scope > p", { hasText: "Closing paragraph after the last section." })).toHaveCount(1);
    await expect(page.locator(".floating-section")).toHaveCount(2);
    await expect(page.locator(".floating-section").first().locator(":scope > p")).toHaveCount(8);
    await expect(page.locator(".floating-section").nth(1).locator(":scope > p")).toHaveCount(8);
    // Nothing leaked through as literal markup.
    await expect(content).not.toContainText("{%");
    await expect(content).not.toContainText("markdown=");
  });

  test("title and text accept inline markdown; text is optional", async ({ page }) => {
    const first = page.locator(".floating-section").first();
    await expect(first.locator(".floating-title em")).toHaveText("note");
    await expect(first.locator(".floating-text")).toHaveText("Its smaller text.");
    await expect(page.locator(".floating-section").nth(1).locator(".floating-title")).toHaveText("Second note");
    await expect(page.locator(".floating-section").nth(1).locator(".floating-text")).toHaveCount(0);

    // Title larger than body text, text smaller.
    const sizes = await first.evaluate((el) => {
      const px = (sel) => parseFloat(getComputedStyle(el.querySelector(sel)).fontSize);
      return { title: px(".floating-title"), text: px(".floating-text"), body: parseFloat(getComputedStyle(el.querySelector(":scope > p")).fontSize) };
    });
    expect(sizes.title).toBeGreaterThan(sizes.body);
    expect(sizes.text).toBeLessThan(sizes.body);
  });

  test("desktop: sits in the left margin, fully on screen", async ({ page }) => {
    await scrollSectionTo(page, 0, 400, 360);
    const g = await geometry(page, 0);
    expect(g.inner.right).toBeLessThanOrEqual(g.section.left);
    expect(g.inner.left).toBeGreaterThanOrEqual(0);
    expect(g.overflowX).toBe(false);
  });

  test("desktop: top aligns with the first paragraph when the section starts below centre", async ({ page }) => {
    await scrollSectionTo(page, 0, 0, 600);
    const g = await geometry(page, 0);
    near(g.inner.top, g.first.top);
  });

  test("desktop: vertically centred while scrolling through the section", async ({ page }) => {
    for (const offset of [400, 700, 1000]) {
      await scrollSectionTo(page, 0, offset, 360);
      const g = await geometry(page, 0);
      near((g.inner.top + g.inner.bottom) / 2, g.viewport.h / 2);
    }
  });

  test("desktop: bottom aligns with the last paragraph when the section ends", async ({ page }) => {
    await scrollSectionEndTo(page, 0, 300);
    const g = await geometry(page, 0);
    near(g.section.bottom, g.last.bottom); // the section excludes the last paragraph's margin
    near(g.inner.bottom, g.last.bottom);
  });

  test("desktop: the next section's note takes over", async ({ page }) => {
    await scrollSectionTo(page, 1, 600, 360);
    const [one, two] = [await geometry(page, 0), await geometry(page, 1)];
    expect(one.inner.bottom).toBeLessThanOrEqual(one.section.bottom + 1);
    expect(one.inner.bottom).toBeLessThan(0); // scrolled well out of view
    near((two.inner.top + two.inner.bottom) / 2, two.viewport.h / 2);
  });

  test("desktop: without the measured height it falls back to a CSS approximation", async ({ page }) => {
    await page.evaluate(() =>
      document.querySelectorAll(".floating-inner").forEach((el) => el.removeAttribute("data-floating-measured")),
    );
    await scrollSectionTo(page, 0, 700, 360);
    const g = await geometry(page, 0);
    near((g.inner.top + g.inner.bottom) / 2, g.viewport.h / 2);
  });

  test("desktop: stays on screen with the larger-size and readable-font options", async ({ page }) => {
    await page.evaluate(() => {
      document.documentElement.setAttribute("data-a11y-size", "on");
      document.documentElement.setAttribute("data-a11y-font", "on");
    });
    await scrollSectionTo(page, 0, 700, 360);
    // Let the ResizeObserver re-measure after the font change.
    await page.waitForFunction(() => {
      const el = document.querySelector(".floating-inner");
      return parseFloat(el.style.getPropertyValue("--floating-h")) === Math.round(el.offsetHeight);
    });
    const g = await geometry(page, 0);
    expect(g.inner.left).toBeGreaterThanOrEqual(0);
    expect(g.inner.right).toBeLessThanOrEqual(g.section.left);
    expect(g.overflowX).toBe(false);
    near((g.inner.top + g.inner.bottom) / 2, g.viewport.h / 2);
  });

  test("below the width threshold it uses the narrow layout", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 800 });
    const positions = await page.evaluate(() => ({
      note: getComputedStyle(document.querySelector(".floating-note")).position,
      inner: getComputedStyle(document.querySelector(".floating-inner")).position,
    }));
    expect(positions).toEqual({ note: "sticky", inner: "static" });
  });

  test("narrow: sticks to the top of the screen, then is pushed off at the section end", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();

    // Header scrolled away: the whole note is pinned at the top, text intact.
    await scrollSectionTo(page, 0, 900, 400);
    let g = await geometry(page, 0);
    near(g.note.top, 0);
    near(g.note.height, g.inner.height + 16, 20);
    await expect(page.locator(".floating-section").first().locator(".floating-text")).toBeVisible();
    expect(g.overflowX).toBe(false);

    // At the start of the section it is in flow (below the header), not pinned.
    await scrollSectionTo(page, 0, 0, 500);
    g = await geometry(page, 0);
    near(g.note.top, g.section.top);

    // Section ending: the note never extends below the last paragraph.
    await scrollSectionEndTo(page, 0, 40);
    g = await geometry(page, 0);
    expect(g.note.bottom).toBeLessThanOrEqual(g.last.bottom + 1);
  });
});
