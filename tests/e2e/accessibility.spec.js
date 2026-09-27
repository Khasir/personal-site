import { test, expect } from "@playwright/test";

const POST = "/posts/hello-world/";
// The header button is icon-only, the footer one is label-only; both
// share the accessible name "accessibility" and stay in sync.
const toggle = (page) => page.locator(".site-header").getByRole("button", { name: "accessibility" });
const footerToggle = (page) => page.locator(".site-footer").getByRole("button", { name: "accessibility" });
const htmlMode = (page) => page.evaluate(() => document.documentElement.getAttribute("data-a11y"));

test("off by default, and the toggle button is exposed as an unpressed button", async ({ page }) => {
  await page.goto("/");
  expect(await htmlMode(page)).toBeNull();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("clicking the toggle switches the mode on and off, and remembers it across pages and reloads", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  expect(await htmlMode(page)).toBe("on");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");

  await page.goto("/posts/");
  expect(await htmlMode(page)).toBe("on");
  await page.reload();
  expect(await htmlMode(page)).toBe("on");

  await toggle(page).click();
  expect(await htmlMode(page)).toBeNull();
  await page.reload();
  expect(await htmlMode(page)).toBeNull();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
});

test("the mode is applied before the body exists (no flash of the default styles)", async ({ page }) => {
  await page.addInitScript(() => {
    try { localStorage.setItem("a11y-mode", "on"); } catch (e) { /* ignore */ }
    // Init scripts run before <html> is parsed (documentElement is null
    // here), so observe the document itself and look for the attribute.
    new MutationObserver((_, observer) => {
      const root = document.documentElement;
      if (root && root.hasAttribute("data-a11y")) {
        window.__bodyExistedWhenApplied = !!document.body;
        observer.disconnect();
      }
    }).observe(document, { attributes: true, childList: true, subtree: true });
  });
  await page.goto("/");
  expect(await htmlMode(page)).toBe("on");
  expect(await page.evaluate(() => window.__bodyExistedWhenApplied)).toBe(false);
});

test("turns on automatically for prefers-contrast: more, and the button overrides it", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await page.goto("/");
  expect(await htmlMode(page)).toBe("on");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");

  await toggle(page).click();
  expect(await htmlMode(page)).toBeNull();
  await page.reload();
  expect(await htmlMode(page)).toBeNull();
});

test("still works when localStorage is unavailable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.addInitScript(() => {
    const fail = () => { throw new Error("storage disabled"); };
    Storage.prototype.getItem = fail;
    Storage.prototype.setItem = fail;
  });
  await page.goto("/");
  await toggle(page).click();
  expect(await htmlMode(page)).toBe("on");
  expect(errors).toEqual([]);
});

test("the mode changes size, contrast, casing and link styling", async ({ page }) => {
  await page.goto(POST);
  const styles = () => page.evaluate(() => {
    const css = (selector) => getComputedStyle(document.querySelector(selector));
    return {
      bodyFontSize: parseFloat(css("body").fontSize),
      bodyColor: css("body").color,
      subtitleColor: css(".entry-meta").color,
      headingTransform: css(".entry-heading h1").textTransform,
      navLinkDecoration: css(".site-nav a").textDecorationLine,
    };
  });

  const before = await styles();
  expect(before.headingTransform).toBe("lowercase");
  expect(before.navLinkDecoration).toBe("none");

  await toggle(page).click();
  const after = await styles();
  expect(after.bodyFontSize).toBeGreaterThan(before.bodyFontSize);
  expect(after.bodyColor).toBe("rgb(0, 0, 0)");
  expect(after.subtitleColor).toBe("rgb(0, 0, 0)");
  expect(after.headingTransform).toBe("none");
  expect(after.navLinkDecoration).toBe("underline");
});

test("entry <title> is lowercased normally and shown as authored in the mode", async ({ page }) => {
  await page.goto(POST);
  const read = () => page.evaluate(() => ({
    title: document.title,
    original: document.documentElement.dataset.originalTitle,
  }));

  let { title, original } = await read();
  expect(title).toBe(original.toLowerCase());

  await toggle(page).click();
  ({ title, original } = await read());
  expect(title).toBe(original);

  await page.reload();
  ({ title, original } = await read());
  expect(title).toBe(original);

  await toggle(page).click();
  ({ title, original } = await read());
  expect(title).toBe(original.toLowerCase());
});

test("on a phone-width screen the header doesn't overflow and the toggle keeps its name", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const on of [false, true]) {
    await page.goto("/");
    if (on) await toggle(page).click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(toggle(page)).toBeVisible();
  }
});

test("header toggle is icon-only, footer toggle is label-only, and the two stay in sync", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".site-header .a11y-icon")).toHaveCount(1);
  await expect(page.locator(".site-footer .a11y-icon")).toHaveCount(0);
  const width = async (locator) => (await locator.boundingBox()).width;
  expect(await width(toggle(page).locator(".a11y-toggle-label"))).toBeLessThanOrEqual(1);
  expect(await width(footerToggle(page).locator(".a11y-toggle-label"))).toBeGreaterThan(20);

  await footerToggle(page).click();
  expect(await htmlMode(page)).toBe("on");
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "true");
  await expect(footerToggle(page)).toHaveAttribute("aria-pressed", "true");

  await toggle(page).click();
  expect(await htmlMode(page)).toBeNull();
  await expect(footerToggle(page)).toHaveAttribute("aria-pressed", "false");
});
