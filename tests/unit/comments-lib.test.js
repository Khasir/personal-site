import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  parseSubmission,
  hashIp,
  isRateLimited,
  getClientIp,
} from "../../functions/_lib/comments.js";

describe("parseSubmission", () => {
  test("accepts a valid comment submission", () => {
    // prefix/suffix get trimmed like every other field, so leading/trailing
    // whitespace in the input shouldn't survive into the stored value.
    const result = parseSubmission(
      { name: "Ada", body: "Nice post!", quote: "some text", prefix: "before ", suffix: " after" },
      { requireQuote: true }
    );
    assert.equal(result.ok, true);
    assert.deepEqual(result.value, {
      name: "Ada",
      body: "Nice post!",
      quote: "some text",
      prefix: "before",
      suffix: "after",
    });
  });

  test("accepts a valid guestbook submission with no quote", () => {
    const result = parseSubmission({ name: "Grace", body: "Hi!" }, { requireQuote: false });
    assert.equal(result.ok, true);
    assert.equal(result.value.quote, null);
    assert.equal(result.value.prefix, "");
    assert.equal(result.value.suffix, "");
  });

  test("rejects when the honeypot field is filled in", () => {
    const result = parseSubmission(
      { name: "Bot", body: "spam", website: "http://spam.example" },
      { requireQuote: false }
    );
    assert.equal(result.ok, false);
  });

  test("rejects when name is missing", () => {
    const result = parseSubmission({ body: "hi" }, { requireQuote: false });
    assert.equal(result.ok, false);
  });

  test("rejects when body is missing", () => {
    const result = parseSubmission({ name: "Ada" }, { requireQuote: false });
    assert.equal(result.ok, false);
  });

  test("rejects when name is only whitespace", () => {
    const result = parseSubmission({ name: "   ", body: "hi" }, { requireQuote: false });
    assert.equal(result.ok, false);
  });

  test("requires a quote for comments but not guestbook entries", () => {
    const comment = parseSubmission({ name: "Ada", body: "hi" }, { requireQuote: true });
    assert.equal(comment.ok, false);

    const guestbookEntry = parseSubmission({ name: "Ada", body: "hi" }, { requireQuote: false });
    assert.equal(guestbookEntry.ok, true);
  });

  test("trims whitespace and truncates overly long fields", () => {
    const longBody = "x".repeat(2000);
    const result = parseSubmission(
      { name: "  Ada  ", body: longBody },
      { requireQuote: false }
    );
    assert.equal(result.ok, true);
    assert.equal(result.value.name, "Ada");
    assert.equal(result.value.body.length, 1000); // MAX_BODY_LEN
  });

  test("rejects a non-object body", () => {
    assert.equal(parseSubmission(null, { requireQuote: false }).ok, false);
    assert.equal(parseSubmission("string", { requireQuote: false }).ok, false);
  });
});

describe("hashIp", () => {
  test("is deterministic for the same ip and salt", async () => {
    const a = await hashIp("203.0.113.1", "salt-a");
    const b = await hashIp("203.0.113.1", "salt-a");
    assert.equal(a, b);
  });

  test("differs when the salt differs", async () => {
    const a = await hashIp("203.0.113.1", "salt-a");
    const b = await hashIp("203.0.113.1", "salt-b");
    assert.notEqual(a, b);
  });

  test("differs when the ip differs", async () => {
    const a = await hashIp("203.0.113.1", "salt-a");
    const b = await hashIp("203.0.113.2", "salt-a");
    assert.notEqual(a, b);
  });

  test("returns a 64-character hex string (SHA-256)", async () => {
    const hash = await hashIp("203.0.113.1", "salt-a");
    assert.match(hash, /^[0-9a-f]{64}$/);
  });
});

describe("isRateLimited", () => {
  function mockDb(count) {
    return {
      prepare() {
        return {
          bind() {
            return { first: async () => ({ n: count }) };
          },
        };
      },
    };
  }

  test("returns false with no ip hash", async () => {
    assert.equal(await isRateLimited(mockDb(999), null), false);
  });

  test("returns false under the limit", async () => {
    assert.equal(await isRateLimited(mockDb(4), "somehash"), false);
  });

  test("returns true at the limit", async () => {
    assert.equal(await isRateLimited(mockDb(5), "somehash"), true);
  });

  test("returns true over the limit", async () => {
    assert.equal(await isRateLimited(mockDb(12), "somehash"), true);
  });
});

describe("getClientIp", () => {
  test("reads the CF-Connecting-IP header", () => {
    const request = new Request("https://example.com", {
      headers: { "CF-Connecting-IP": "203.0.113.5" },
    });
    assert.equal(getClientIp(request), "203.0.113.5");
  });

  test("falls back to a placeholder when the header is missing", () => {
    const request = new Request("https://example.com");
    assert.equal(getClientIp(request), "0.0.0.0");
  });
});
