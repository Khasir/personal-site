import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { groupNewComments, buildEmailBody, buildFromHeader } from "../src/lib.js";

describe("groupNewComments", () => {
  test("groups comment rows by post_slug, sorted by count desc", () => {
    const rows = [
      { kind: "comment", post_slug: "a" },
      { kind: "comment", post_slug: "b" },
      { kind: "comment", post_slug: "a" },
      { kind: "comment", post_slug: "a" },
    ];
    const { byPostSlug, guestbookCount } = groupNewComments(rows);
    assert.deepEqual(byPostSlug, [
      { post_slug: "a", count: 3 },
      { post_slug: "b", count: 1 },
    ]);
    assert.equal(guestbookCount, 0);
  });

  test("counts guestbook rows separately, not by post_slug", () => {
    const rows = [
      { kind: "guestbook", post_slug: null },
      { kind: "guestbook", post_slug: null },
      { kind: "comment", post_slug: "a" },
    ];
    const { byPostSlug, guestbookCount } = groupNewComments(rows);
    assert.deepEqual(byPostSlug, [{ post_slug: "a", count: 1 }]);
    assert.equal(guestbookCount, 2);
  });

  test("handles no new rows", () => {
    const { byPostSlug, guestbookCount } = groupNewComments([]);
    assert.deepEqual(byPostSlug, []);
    assert.equal(guestbookCount, 0);
  });
});

describe("buildEmailBody", () => {
  test("returns null when there's nothing new", () => {
    const result = buildEmailBody({ byPostSlug: [], guestbookCount: 0 });
    assert.equal(result, null);
  });

  test("builds a subject/body for comments only, singular vs plural wording", () => {
    const result = buildEmailBody({
      byPostSlug: [{ post_slug: "my-post", count: 1 }],
      guestbookCount: 0,
    });
    assert.equal(result.subject, "1 new comment across 1 page");
    assert.match(result.text, /- my-post: 1 new comment$/);
  });

  test("builds a subject/body for multiple pages", () => {
    const result = buildEmailBody({
      byPostSlug: [
        { post_slug: "popular", count: 3 },
        { post_slug: "quiet", count: 1 },
      ],
      guestbookCount: 0,
    });
    assert.equal(result.subject, "4 new comments across 2 pages");
    assert.match(result.text, /- popular: 3 new comments/);
    assert.match(result.text, /- quiet: 1 new comment$/);
  });

  test("includes guestbook count in subject and body, omitted when zero", () => {
    const result = buildEmailBody({
      byPostSlug: [{ post_slug: "a", count: 1 }],
      guestbookCount: 2,
    });
    assert.equal(result.subject, "1 new comment across 1 page + 2 new guestbook entries");
    assert.match(result.text, /- guestbook: 2 new entries/);
  });

  test("guestbook-only digest has no comment subject clause", () => {
    const result = buildEmailBody({ byPostSlug: [], guestbookCount: 1 });
    assert.equal(result.subject, "1 new guestbook entry");
    assert.match(result.text, /- guestbook: 1 new entry$/);
  });

  test("labels the homepage slug '/' as 'home'", () => {
    const result = buildEmailBody({
      byPostSlug: [{ post_slug: "/", count: 2 }],
      guestbookCount: 0,
    });
    assert.match(result.text, /- home: 2 new comments$/);
  });
});

describe("buildFromHeader", () => {
  test("wraps the email with a display name when one is set", () => {
    assert.equal(
      buildFromHeader("digest@example.com", "Personal Site Comments"),
      "Personal Site Comments <digest@example.com>"
    );
  });

  test("falls back to the bare email when no name is set", () => {
    assert.equal(buildFromHeader("digest@example.com", undefined), "digest@example.com");
    assert.equal(buildFromHeader("digest@example.com", ""), "digest@example.com");
  });
});
