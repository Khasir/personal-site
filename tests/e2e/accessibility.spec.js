import { test, expect } from "@playwright/test";

const POST = "/posts/hello-world/";
// The header trigger is icon-only, the footer one is label-only; both share the
// accessible name "accessibility", and each opens its own two-option menu.
const toggle = (page) => page.locator(".site-header").getByRole("button", { name: "accessibility" });
const footerToggle = (page) => page.locator(".site-footer").getByRole("button", { name: "accessibility" });
const fontOpt = (page, where = ".site-header") => page.locator(where).getByRole("button", { name: "More readable font" });
const sizeOpt = (page, where = ".site-header") => page.locator(where).getByRole("button", { name: "Larger font size" });
const attr = (page, name) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
const htmlFont = (page) => attr(page, "data-a11y-font");
const htmlSize = (page) => attr(page, "data-a11y-size");
const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);

// Sets a localStorage value once per test (not on every navigation, so a
// value the page removes or rewrites isn't put back on reload).
const seedStorage = (page, key, value) =>
  page.addInitScript(([k, v]) => {
    if (sessionStorage.getItem("seeded:" + k)) return;
    sessionStorage.setItem("seeded:" + k, "1");
    localStorage.setItem(k, v);
  }, [key, value]);

const styles = (page) => page.evaluate(() => {
  const css = (selector) => getComputedStyle(document.querySelector(selector));
  return {
    bodyFontSize: parseFloat(css("body").fontSize),
    bodyFontFamily: css("body").fontFamily,
    bodyColor: css("body").color,
    subtitleColor: css(".entry-meta").color,
    headingTransform: css(".entry-heading h1").textTransform,
    navLinkDecoration: css(".site-nav a").textDecorationLine,
  };
});

test("both options are off by default, and the menu is closed", async ({ page }) => {
  await page.goto("/");
  expect(await htmlFont(page)).toBeNull();
  expect(await htmlSize(page)).toBeNull();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
  await expect(fontOpt(page)).toBeHidden();
  await expect(sizeOpt(page)).toBeHidden();
});

test("the trigger opens the menu; the options are unpressed buttons", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "true");
  await expect(fontOpt(page)).toBeVisible();
  await expect(fontOpt(page)).toHaveAttribute("aria-pressed", "false");
  await expect(sizeOpt(page)).toHaveAttribute("aria-pressed", "false");

  await toggle(page).click();
  await expect(fontOpt(page)).toBeHidden();
  await expect(toggle(page)).toHaveAttribute("aria-expanded", "false");
});

test("outside click and Escape close the menu; Escape returns focus to the trigger", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  await page.mouse.click(5, 400);
  await expect(fontOpt(page)).toBeHidden();

  await toggle(page).click();
  await fontOpt(page).click();
  await expect(fontOpt(page)).toBeVisible(); // clicking an option keeps the menu open
  await page.keyboard.press("Escape");
  await expect(fontOpt(page)).toBeHidden();
  await expect(toggle(page)).toBeFocused();
});

test("opening one menu closes the other", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  await footerToggle(page).click();
  await expect(fontOpt(page, ".site-header")).toBeHidden();
  await expect(fontOpt(page, ".site-footer")).toBeVisible();
});

test("the options switch on and off independently, and are remembered across pages and reloads", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();

  await fontOpt(page).click();
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBeNull();
  await expect(fontOpt(page)).toHaveAttribute("aria-pressed", "true");
  await expect(sizeOpt(page)).toHaveAttribute("aria-pressed", "false");

  await sizeOpt(page).click();
  expect(await htmlSize(page)).toBe("on");

  await page.goto("/posts/");
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBe("on");
  await page.reload();
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBe("on");

  await toggle(page).click();
  await fontOpt(page).click();
  expect(await htmlFont(page)).toBeNull();
  expect(await htmlSize(page)).toBe("on");
  await page.reload();
  expect(await htmlFont(page)).toBeNull();
  expect(await htmlSize(page)).toBe("on");
  await toggle(page).click();
  await expect(fontOpt(page)).toHaveAttribute("aria-pressed", "false");
  await expect(sizeOpt(page)).toHaveAttribute("aria-pressed", "true");
});

test("the options are applied before the body exists (no flash of the default styles)", async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.setItem("a11y-font", "on");
      localStorage.setItem("a11y-size", "on");
    } catch (e) { /* ignore */ }
    // Init scripts run before <html> is parsed (documentElement is null
    // here), so observe the document itself and look for the attributes.
    window.__bodyExistedWhenApplied = {};
    new MutationObserver((_, observer) => {
      const root = document.documentElement;
      if (!root) return;
      for (const name of ["data-a11y-font", "data-a11y-size"]) {
        if (root.hasAttribute(name) && !(name in window.__bodyExistedWhenApplied)) {
          window.__bodyExistedWhenApplied[name] = !!document.body;
        }
      }
      if (Object.keys(window.__bodyExistedWhenApplied).length === 2) observer.disconnect();
    }).observe(document, { attributes: true, childList: true, subtree: true });
  });
  await page.goto("/");
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBe("on");
  expect(await page.evaluate(() => window.__bodyExistedWhenApplied)).toEqual({
    "data-a11y-font": false,
    "data-a11y-size": false,
  });
});

test("turns both on automatically for prefers-contrast: more, and each option overrides it", async ({ page }) => {
  await page.emulateMedia({ contrast: "more" });
  await page.goto("/");
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBe("on");
  await toggle(page).click();
  await expect(fontOpt(page)).toHaveAttribute("aria-pressed", "true");
  await expect(sizeOpt(page)).toHaveAttribute("aria-pressed", "true");

  await fontOpt(page).click();
  expect(await htmlFont(page)).toBeNull();
  expect(await htmlSize(page)).toBe("on");
  await page.reload();
  expect(await htmlFont(page)).toBeNull();
  expect(await htmlSize(page)).toBe("on");
});

test("still works when localStorage is unavailable", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  await page.addInitScript(() => {
    const fail = () => { throw new Error("storage disabled"); };
    Storage.prototype.getItem = fail;
    Storage.prototype.setItem = fail;
    Storage.prototype.removeItem = fail;
  });
  await page.goto("/");
  await toggle(page).click();
  await fontOpt(page).click();
  await sizeOpt(page).click();
  expect(await htmlFont(page)).toBe("on");
  expect(await htmlSize(page)).toBe("on");
  expect(errors).toEqual([]);
});

test.describe("legacy single-switch key (a11y-mode)", () => {
  test("\"on\" enables both options for returning visitors, and is left alone until a click", async ({ page }) => {
    await seedStorage(page, "a11y-mode", "on");
    await page.goto("/");
    expect(await htmlFont(page)).toBe("on");
    expect(await htmlSize(page)).toBe("on");
    await toggle(page).click();
    await expect(fontOpt(page)).toHaveAttribute("aria-pressed", "true");
    await expect(sizeOpt(page)).toHaveAttribute("aria-pressed", "true");
    expect(await stored(page, "a11y-mode")).toBe("on");
  });

  test("clicking an option migrates it: the legacy key goes, the other option keeps its state", async ({ page }) => {
    await seedStorage(page, "a11y-mode", "on");
    await page.goto("/");
    await toggle(page).click();
    await fontOpt(page).click();

    expect(await stored(page, "a11y-mode")).toBeNull();
    expect(await stored(page, "a11y-font")).toBe("off");
    expect(await stored(page, "a11y-size")).toBe("on");
    expect(await htmlFont(page)).toBeNull();
    expect(await htmlSize(page)).toBe("on");

    await page.reload();
    expect(await htmlFont(page)).toBeNull();
    expect(await htmlSize(page)).toBe("on");
  });

  test("\"off\" is an explicit choice that beats prefers-contrast, and migrates the same way", async ({ page }) => {
    await page.emulateMedia({ contrast: "more" });
    await seedStorage(page, "a11y-mode", "off");
    await page.goto("/");
    expect(await htmlFont(page)).toBeNull();
    expect(await htmlSize(page)).toBeNull();

    await toggle(page).click();
    await sizeOpt(page).click();
    expect(await stored(page, "a11y-mode")).toBeNull();
    expect(await stored(page, "a11y-font")).toBe("off");
    expect(await stored(page, "a11y-size")).toBe("on");
    await page.reload();
    expect(await htmlFont(page)).toBeNull();
    expect(await htmlSize(page)).toBe("on");
  });
});

test("the font option changes the font, contrast, casing and links, but not the size", async ({ page }) => {
  await page.goto(POST);
  const before = await styles(page);
  expect(before.headingTransform).toBe("lowercase");
  expect(before.navLinkDecoration).toBe("none");
  expect(before.bodyFontFamily).not.toContain("Aleo");

  await toggle(page).click();
  await fontOpt(page).click();
  const after = await styles(page);
  expect(after.bodyFontFamily).toContain("Aleo");
  expect(after.bodyColor).toBe("rgb(0, 0, 0)");
  expect(after.subtitleColor).toBe("rgb(0, 0, 0)");
  expect(after.headingTransform).toBe("none");
  expect(after.navLinkDecoration).toBe("underline");
  expect(after.bodyFontSize).toBe(before.bodyFontSize);
});

test("the size option only enlarges the text", async ({ page }) => {
  await page.goto(POST);
  const before = await styles(page);

  await toggle(page).click();
  await sizeOpt(page).click();
  const after = await styles(page);
  expect(after.bodyFontSize).toBeGreaterThan(before.bodyFontSize);
  expect(after.bodyFontFamily).toBe(before.bodyFontFamily);
  expect(after.bodyColor).toBe(before.bodyColor);
  expect(after.subtitleColor).toBe(before.subtitleColor);
  expect(after.headingTransform).toBe("lowercase");
  expect(after.navLinkDecoration).toBe("none");
});

test("the menu always has the accessible look, even with both options off", async ({ page }) => {
  await page.goto(POST);
  expect((await styles(page)).bodyFontFamily).not.toContain("Aleo");
  await toggle(page).click();
  const menu = await page.evaluate(() => {
    const menu = getComputedStyle(document.querySelector("#a11y-menu-header"));
    const button = getComputedStyle(document.querySelector("#a11y-menu-header button"));
    return {
      fontFamily: menu.fontFamily,
      fontSize: parseFloat(menu.fontSize),
      color: menu.color,
      buttonDecoration: button.textDecorationLine,
    };
  });
  expect(menu.fontFamily).toContain("Aleo");
  expect(menu.fontSize).toBeGreaterThanOrEqual(18);
  expect(menu.color).toBe("rgb(0, 0, 0)");
  expect(menu.buttonDecoration).toBe("underline");
});

test("entry <title> is lowercased normally and shown as authored with the font option; the size option leaves it alone", async ({ page }) => {
  await page.goto(POST);
  const read = () => page.evaluate(() => ({
    title: document.title,
    original: document.documentElement.dataset.originalTitle,
  }));

  let { title, original } = await read();
  expect(title).toBe(original.toLowerCase());

  await toggle(page).click();
  await sizeOpt(page).click();
  ({ title, original } = await read());
  expect(title).toBe(original.toLowerCase());

  await fontOpt(page).click();
  ({ title, original } = await read());
  expect(title).toBe(original);

  await page.reload();
  ({ title, original } = await read());
  expect(title).toBe(original);

  await toggle(page).click();
  await fontOpt(page).click();
  ({ title, original } = await read());
  expect(title).toBe(original.toLowerCase());
});

test("on a phone-width screen nothing overflows and the open menus stay on screen", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const on of [false, true]) {
    await page.goto("/");
    if (on) {
      await toggle(page).click();
      await fontOpt(page).click();
      await sizeOpt(page).click();
      await toggle(page).click(); // close
    }
    await expect(toggle(page)).toBeVisible();

    for (const [trigger, where] of [[toggle(page), "#a11y-menu-header"], [footerToggle(page), "#a11y-menu-footer"]]) {
      await trigger.click();
      const box = await page.locator(where).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    }
  }
});

test("the header menu opens below its trigger, the footer one above; the trigger styles follow either option", async ({ page }) => {
  await page.goto("/");
  await toggle(page).click();
  const trigger = await toggle(page).boundingBox();
  const header = await page.locator("#a11y-menu-header").boundingBox();
  expect(header.y).toBeGreaterThanOrEqual(trigger.y + trigger.height);

  await footerToggle(page).click();
  const footerTrigger = await footerToggle(page).boundingBox();
  const footer = await page.locator("#a11y-menu-footer").boundingBox();
  expect(footer.y + footer.height).toBeLessThanOrEqual(footerTrigger.y + 1);

  const disc = () => page.locator(".site-header .a11y-icon-disc").evaluate((el) => getComputedStyle(el).opacity);
  expect(await disc()).toBe("0");
  await fontOpt(page, ".site-footer").click();
  expect(await disc()).toBe("1");
  await fontOpt(page, ".site-footer").click();
  await sizeOpt(page, ".site-footer").click();
  expect(await disc()).toBe("1");
  await sizeOpt(page, ".site-footer").click();
  expect(await disc()).toBe("0");
});

test("header trigger is icon-only, footer trigger is label-only, and the two menus stay in sync", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".site-header .a11y-icon")).toHaveCount(1);
  await expect(page.locator(".site-footer .a11y-icon")).toHaveCount(0);
  const width = async (locator) => (await locator.boundingBox()).width;
  expect(await width(toggle(page).locator(".a11y-toggle-label"))).toBeLessThanOrEqual(1);
  expect(await width(footerToggle(page).locator(".a11y-toggle-label"))).toBeGreaterThan(20);

  await footerToggle(page).click();
  await fontOpt(page, ".site-footer").click();
  expect(await htmlFont(page)).toBe("on");
  // The header's menu reflects it too (checked via attributes, it's closed).
  await expect(page.locator("#a11y-menu-header [data-a11y-option=font]")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#a11y-menu-footer [data-a11y-option=font]")).toHaveAttribute("aria-pressed", "true");

  await toggle(page).click();
  await fontOpt(page).click();
  expect(await htmlFont(page)).toBeNull();
  await expect(page.locator("#a11y-menu-footer [data-a11y-option=font]")).toHaveAttribute("aria-pressed", "false");
});
