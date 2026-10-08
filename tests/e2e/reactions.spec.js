import { test, expect } from "@playwright/test";
import { selectText, uniqueTag, fakeIp } from "./helpers.js";

const POST_URL = "/posts/hello-world/";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "CF-Connecting-IP": fakeIp() });
});

// Posts a comment through the UI (same flow as comments.spec.js) and returns
// the created record.
async function submitComment(page, { name, body }) {
  const responsePromise = page.waitForResponse(
    (res) => res.url().includes("/api/comments") && res.request().method() === "POST"
  );
  await page.locator("[data-comment-trigger]").click();
  await page.locator("#comment-name").fill(name);
  await page.locator("#comment-body").fill(body);
  await page.locator("[data-comment-form]").locator('button[type="submit"]').click();
  const created = await (await responsePromise).json();
  await expect(page.locator("[data-comment-form-status]")).toHaveText(/thank you/i);
  await expect(page.locator("[data-comment-form-dialog]")).toBeHidden();
  return created;
}

// Creates a fresh comment on the post and opens its thread, returning the
// comment record and the locator for its <li> in the thread popover.
async function openFreshThread(page) {
  await page.goto(POST_URL);
  await selectText(page, "no account required");
  const tag = uniqueTag();
  const created = await submitComment(page, { name: "Reactor", body: `react to me ${tag}` });
  await page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`).first().click();
  const item = page.locator("[data-comment-thread-list] li", { hasText: tag });
  await expect(item).toBeVisible();
  return { created, item, tag };
}

function reactionsOf(item) {
  return item.locator(".comment-reactions");
}

async function react(item, label) {
  await item.hover();
  await item.locator(".reaction-add").click();
  await item.locator(`.reaction-option[aria-label="${label}"]`).click();
}

test.describe("the reaction button and picker", () => {
  test("+☺ is hidden until the comment is hovered, and offers every emoji in the set", async ({ page }) => {
    const { item } = await openFreshThread(page);
    const add = item.locator(".reaction-add");

    await page.mouse.move(0, 0);
    await expect(add).toHaveCSS("opacity", "0");
    await item.hover();
    await expect(add).toHaveCSS("opacity", "1");

    await add.click();
    await expect(item.locator(".reaction-option")).toHaveText(["👍", "💖", "😆", "😢", "👀", "🎉", "🎨"]);
  });

  test("+☺ shows when the comment is keyboard-focused, and Escape closes the picker", async ({ page }) => {
    const { item } = await openFreshThread(page);
    const add = item.locator(".reaction-add");

    await add.focus();
    await expect(add).toHaveCSS("opacity", "1");

    await page.keyboard.press("Enter");
    await expect(add).toHaveAttribute("aria-expanded", "true");
    await expect(item.locator(".reaction-picker")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(item.locator(".reaction-picker")).toBeHidden();
    await expect(add).toBeFocused();
    // Escape only closes the picker, not the whole thread.
    await expect(page.locator("[data-comment-thread-popover]")).toBeVisible();
  });
});

test.describe("layout", () => {
  test("a comment with no reactions reserves no blank row, and +☺ floats at the bottom-right of the body", async ({ page }) => {
    const { item } = await openFreshThread(page);

    expect(await reactionsOf(item).evaluate((el) => el.offsetHeight)).toBe(0);

    const bodyBox = await item.locator(".comment-body").boundingBox();
    const addBox = await item.locator(".reaction-add").boundingBox();
    // Level with the bottom of the body text, not up beside the author name.
    expect(Math.abs(addBox.y + addBox.height - (bodyBox.y + bodyBox.height))).toBeLessThan(8);
    expect(addBox.x + addBox.width).toBeLessThanOrEqual(bodyBox.x + bodyBox.width + 1);
    expect(addBox.x + addBox.width).toBeGreaterThan(bodyBox.x + bodyBox.width - 8);
  });

  test("opening the picker expands the comment with a row below its text", async ({ page }) => {
    const { item } = await openFreshThread(page);
    const before = (await item.boundingBox()).height;

    await item.hover();
    await item.locator(".reaction-add").click();

    const picker = await item.locator(".reaction-picker").boundingBox();
    const body = await item.locator(".comment-body").boundingBox();
    expect(picker.y).toBeGreaterThanOrEqual(body.y + body.height);
    expect((await item.boundingBox()).height).toBeGreaterThan(before);
  });
});

test.describe("accessibility mode", () => {
  test("+☺ sits below the body text, to the left of any pills", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("a11y-mode", "on"));
    const { item } = await openFreshThread(page);
    await expect(page.locator("html")).toHaveAttribute("data-a11y", "on");

    const add = item.locator(".reaction-add");
    await expect(add).toHaveCSS("opacity", "1");

    const bodyBox = await item.locator(".comment-body").boundingBox();
    const addBox = await add.boundingBox();
    expect(addBox.y).toBeGreaterThanOrEqual(bodyBox.y + bodyBox.height - 1);

    await react(item, "thumbs up");
    const pillBox = await reactionsOf(item).locator(".reaction-pill").boundingBox();
    const addAfter = await add.boundingBox();
    expect(addAfter.x + addAfter.width).toBeLessThanOrEqual(pillBox.x + 1);
    expect(Math.abs(addAfter.y - pillBox.y)).toBeLessThan(8);
  });
});

test.describe("touch devices", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 375, height: 812 } });

  test("+☺ sits below the body text, to the left of any pills", async ({ page }) => {
    const { item } = await openFreshThread(page);
    expect(await page.evaluate(() => matchMedia("(hover: none)").matches)).toBe(true);

    const add = item.locator(".reaction-add");
    await expect(add).toHaveCSS("opacity", "1");

    const bodyBox = await item.locator(".comment-body").boundingBox();
    const addBox = await add.boundingBox();
    expect(addBox.y).toBeGreaterThanOrEqual(bodyBox.y + bodyBox.height - 1);

    await add.click();
    await item.locator('.reaction-option[aria-label="thumbs up"]').click();
    const pillBox = await reactionsOf(item).locator(".reaction-pill").boundingBox();
    const addAfter = await add.boundingBox();
    expect(addAfter.x + addAfter.width).toBeLessThanOrEqual(pillBox.x + 1);
    expect(Math.abs(addAfter.y - pillBox.y)).toBeLessThan(8);
  });
});

test.describe("adding and removing reactions", () => {
  test("choosing an emoji adds a pressed pill with a count of 1, and closes the picker", async ({ page }) => {
    const { item } = await openFreshThread(page);
    await react(item, "thumbs up");

    const pill = reactionsOf(item).locator(".reaction-pill");
    await expect(pill).toHaveCount(1);
    await expect(pill).toHaveText("👍 1");
    await expect(pill).toHaveAttribute("aria-pressed", "true");
    await expect(item.locator(".reaction-picker")).toBeHidden();
    // The thread stays open (the re-render mustn't look like an outside click).
    await expect(page.locator("[data-comment-thread-popover]")).toBeVisible();
  });

  test("clicking your own pill takes the reaction back", async ({ page }) => {
    const { item } = await openFreshThread(page);
    await react(item, "heart");
    await expect(reactionsOf(item).locator(".reaction-pill")).toHaveText("💖 1");

    await reactionsOf(item).locator(".reaction-pill").click();
    await expect(reactionsOf(item).locator(".reaction-pill")).toHaveCount(0);
    await expect(reactionsOf(item).locator(".reaction-add")).toBeFocused();
  });

  test("a reaction persists across a reload and still shows as yours", async ({ page }) => {
    const { created, item } = await openFreshThread(page);
    await react(item, "eyes");
    await expect(reactionsOf(item).locator(".reaction-pill")).toHaveText("👀 1");

    await page.reload();
    await page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`).first().click();
    const pill = page.locator(`[data-reactions-for="${created.id}"] .reaction-pill`);
    await expect(pill).toHaveText("👀 1");
    await expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  test("someone else's reaction shows its count but isn't marked as yours, and clicking adds to it", async ({ page }) => {
    const { created } = await openFreshThread(page);

    // Another visitor reacting (no localStorage entry in this browser).
    const res = await page.request.post("/api/reactions", {
      data: { comment_id: created.id, emoji: "😆", action: "add" },
    });
    expect(res.ok()).toBe(true);

    await page.reload();
    await page.locator(`mark.comment-highlight[data-comment-ids*="${created.id}"]`).first().click();
    const pill = page.locator(`[data-reactions-for="${created.id}"] .reaction-pill`);
    await expect(pill).toHaveText("😆 1");
    await expect(pill).toHaveAttribute("aria-pressed", "false");

    await pill.click();
    await expect(pill).toHaveText("😆 2");
    await expect(pill).toHaveAttribute("aria-pressed", "true");
  });

  test("works for the session even when localStorage is unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() { throw new Error("blocked"); },
      });
    });
    const { item } = await openFreshThread(page);
    await react(item, "sad");
    await expect(reactionsOf(item).locator(".reaction-pill")).toHaveText("😢 1");
  });

  test("a failed request rolls the reaction back", async ({ page }) => {
    const { item } = await openFreshThread(page);
    await page.route("**/api/reactions", (route) => route.fulfill({ status: 500, body: "{}" }));
    await react(item, "laughing");
    await expect(reactionsOf(item).locator(".reaction-pill")).toHaveCount(0);
  });
});

test.describe("count display", () => {
  // Serve a canned comment so we don't need 100 real reactions. Its quote
  // must exist in the post for it to anchor and show up.
  const canned = {
    id: "canned-comment-id",
    author_name: "Canned",
    body: "lots of reactions",
    quote: "no account required",
    prefix: "",
    suffix: "",
    created_at: "2026-01-01T00:00:00.000Z",
    reactions: { "😆": 250, "👍": 100, "💖": 99, "😢": 1 },
  };

  test("counts of 100 or more display as 99+; 99 and below are shown as-is", async ({ page }) => {
    await page.route("**/api/comments?slug=*", (route) => route.fulfill({ json: [canned] }));
    await page.goto(POST_URL);
    await page.locator("mark.comment-highlight").first().click();

    const pills = page.locator('[data-reactions-for="canned-comment-id"] .reaction-pill');
    await expect(pills).toHaveText(["👍 99+", "💖 99", "😆 99+", "😢 1"]);
    // The accessible name keeps the real number.
    await expect(pills.first()).toHaveAttribute("aria-label", /250 reactions/);
  });
});

test.describe("POST /api/reactions", () => {
  // The `request` fixture doesn't pick up the page-level fake IP header, so
  // set one per call to stay out of the shared rate-limit bucket.
  async function newComment(request, slug = `reactions-api-${uniqueTag()}`) {
    const res = await request.post("/api/comments", {
      headers: { "CF-Connecting-IP": fakeIp() },
      data: { post_slug: slug, name: "API", body: "api test", quote: "some text", prefix: "", suffix: "" },
    });
    expect(res.status()).toBe(201);
    return { ...(await res.json()), slug };
  }

  test("increments and decrements, and never goes below zero", async ({ request }) => {
    const { id } = await newComment(request);
    const post = (action) =>
      request.post("/api/reactions", { data: { comment_id: id, emoji: "👍", action } }).then((r) => r.json());

    expect((await post("add")).count).toBe(1);
    expect((await post("add")).count).toBe(2);
    expect((await post("remove")).count).toBe(1);
    expect((await post("remove")).count).toBe(0);
    expect((await post("remove")).count).toBe(0);
  });

  test("GET /api/comments includes reaction counts, and omits zeroed ones", async ({ request }) => {
    const { id, slug } = await newComment(request);
    await request.post("/api/reactions", { data: { comment_id: id, emoji: "💖", action: "add" } });
    await request.post("/api/reactions", { data: { comment_id: id, emoji: "👀", action: "add" } });
    await request.post("/api/reactions", { data: { comment_id: id, emoji: "👀", action: "remove" } });

    const comments = await (await request.get(`/api/comments?slug=${slug}`)).json();
    const mine = comments.find((c) => c.id === id);
    expect(mine.reactions).toEqual({ "💖": 1 });
  });

  test("rejects an unsupported emoji, a bad action and a missing comment id", async ({ request }) => {
    const { id } = await newComment(request);
    const bad = (data) => request.post("/api/reactions", { data });
    expect((await bad({ comment_id: id, emoji: "🔥", action: "add" })).status()).toBe(400);
    expect((await bad({ comment_id: id, emoji: "👍", action: "toggle" })).status()).toBe(400);
    expect((await bad({ emoji: "👍", action: "add" })).status()).toBe(400);
  });

  test("404s for an unknown comment", async ({ request }) => {
    const res = await request.post("/api/reactions", {
      data: { comment_id: "does-not-exist", emoji: "👍", action: "add" },
    });
    expect(res.status()).toBe(404);
  });

  test("404s for a guestbook entry", async ({ request }) => {
    const entry = await (
      await request.post("/api/guestbook", {
        headers: { "CF-Connecting-IP": fakeIp() },
        data: { name: "Guest", body: "hello" },
      })
    ).json();
    const res = await request.post("/api/reactions", {
      data: { comment_id: entry.id, emoji: "👍", action: "add" },
    });
    expect(res.status()).toBe(404);
  });
});
