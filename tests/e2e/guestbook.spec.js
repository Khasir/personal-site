import { test, expect } from "@playwright/test";
import { uniqueTag, fakeIp } from "./helpers.js";

// The rate limiter is shared across comments and guestbook entries alike
// (same table, same ip_hash) -- give each test its own fake IP so this
// file's writes don't collide with comments.spec.js's. See fakeIp() in
// helpers.js for why this is safe to do from a test.
test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": fakeIp() });
});

test("signing the guestbook adds an entry to the list", async ({ page }) => {
  await page.goto("/guestbook/");
  const tag = uniqueTag();
  const name = `Visitor-${tag}`;
  const message = `Just stopping by, ${tag}`;

  await page.locator("#gb-name").fill(name);
  await page.locator("#gb-message").fill(message);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/guestbook") && res.request().method() === "POST"
  );
  await page.locator("[data-guestbook-form]").locator('button[type="submit"]').click();
  await responsePromise;

  await expect(page.locator("[data-guestbook-status]")).toHaveAttribute("data-state", "success");
  await expect(page.locator("[data-guestbook-entries]")).toContainText(name);
  await expect(page.locator("[data-guestbook-entries]")).toContainText(message);
});

test("signing with only a name omits email and message from the entry", async ({ page }) => {
  await page.goto("/guestbook/");
  const tag = uniqueTag();
  const name = `NameOnly-${tag}`;

  await page.locator("#gb-name").fill(name);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/guestbook") && res.request().method() === "POST"
  );
  await page.locator("[data-guestbook-form]").locator('button[type="submit"]').click();
  await responsePromise;

  await expect(page.locator("[data-guestbook-status]")).toHaveAttribute("data-state", "success");
  const entry = page.locator("[data-guestbook-entries] li", { hasText: name });
  await expect(entry).toBeVisible();
  await expect(entry.locator(".guestbook-email")).toHaveCount(0);
  await expect(entry.locator(".comment-body")).toHaveCount(0);
});

test("an email is shown publicly as a mailto link on the entry", async ({ page }) => {
  await page.goto("/guestbook/");
  const tag = uniqueTag();
  const name = `Emailer-${tag}`;
  const email = `${tag}@example.com`;

  await page.locator("#gb-name").fill(name);
  await page.locator("#gb-email").fill(email);

  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/guestbook") && res.request().method() === "POST"
  );
  await page.locator("[data-guestbook-form]").locator('button[type="submit"]').click();
  await responsePromise;

  await expect(page.locator("[data-guestbook-status]")).toHaveAttribute("data-state", "success");
  const entry = page.locator("[data-guestbook-entries] li", { hasText: name });
  const emailLink = entry.locator(".guestbook-email");
  await expect(emailLink).toHaveText(email);
  await expect(emailLink).toHaveAttribute("href", `mailto:${email}`);
});

test("the honeypot silently rejects a bot-like submission", async ({ page }) => {
  await page.goto("/guestbook/");
  const tag = uniqueTag();

  await page.locator("#gb-name").fill(`Bot-${tag}`);
  await page.locator("#gb-message").fill("spam");
  await page.locator("#gb-website").fill("http://spam.example");
  await page.locator("[data-guestbook-form]").locator('button[type="submit"]').click();

  await expect(page.locator("[data-guestbook-status]")).toHaveAttribute("data-state", "error");
  await expect(page.locator("[data-guestbook-entries]")).not.toContainText(`Bot-${tag}`);
});
