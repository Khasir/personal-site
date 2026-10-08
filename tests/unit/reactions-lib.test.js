import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { REACTION_EMOJIS, parseReaction, groupReactions } from "../../functions/_lib/reactions.js";

describe("parseReaction", () => {
  test("accepts every supported emoji for both actions", () => {
    for (const emoji of REACTION_EMOJIS) {
      for (const action of ["add", "remove"]) {
        const result = parseReaction({ comment_id: "abc", emoji, action });
        assert.equal(result.ok, true, `${emoji} ${action}`);
        assert.deepEqual(result.value, { commentId: "abc", emoji, action });
      }
    }
  });

  test("the supported set is the agreed emoji, in display order", () => {
    assert.deepEqual(REACTION_EMOJIS, ["👍", "💖", "😆", "😢", "👀", "🎉", "🎨"]);
  });

  test("trims the comment id", () => {
    const result = parseReaction({ comment_id: "  abc  ", emoji: "👍", action: "add" });
    assert.equal(result.value.commentId, "abc");
  });

  test("rejects 💡, which was dropped from the set", () => {
    assert.equal(parseReaction({ comment_id: "abc", emoji: "💡", action: "add" }).ok, false);
  });

  test("rejects an emoji outside the fixed set", () => {
    assert.equal(parseReaction({ comment_id: "abc", emoji: "🔥", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: "abc", emoji: "", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: "abc", action: "add" }).ok, false);
  });

  test("rejects the red heart emoji (the set uses 💖)", () => {
    assert.equal(parseReaction({ comment_id: "abc", emoji: "❤️", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: "abc", emoji: "❤", action: "add" }).ok, false);
  });

  test("rejects an unknown or missing action", () => {
    assert.equal(parseReaction({ comment_id: "abc", emoji: "👍", action: "toggle" }).ok, false);
    assert.equal(parseReaction({ comment_id: "abc", emoji: "👍" }).ok, false);
  });

  test("rejects a missing, blank, non-string or oversized comment id", () => {
    assert.equal(parseReaction({ emoji: "👍", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: "   ", emoji: "👍", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: 42, emoji: "👍", action: "add" }).ok, false);
    assert.equal(parseReaction({ comment_id: "x".repeat(65), emoji: "👍", action: "add" }).ok, false);
  });

  test("rejects a non-object body", () => {
    assert.equal(parseReaction(null).ok, false);
    assert.equal(parseReaction("string").ok, false);
  });
});

describe("groupReactions", () => {
  test("groups rows by comment", () => {
    const grouped = groupReactions([
      { comment_id: "a", emoji: "👍", count: 3 },
      { comment_id: "b", emoji: "💖", count: 1 },
      { comment_id: "a", emoji: "👀", count: 2 },
    ]);
    assert.deepEqual(grouped, { a: { "👍": 3, "👀": 2 }, b: { "💖": 1 } });
  });

  test("orders each comment's emoji by the fixed display order, not row order", () => {
    const grouped = groupReactions([
      { comment_id: "a", emoji: "🎨", count: 1 },
      { comment_id: "a", emoji: "😆", count: 1 },
      { comment_id: "a", emoji: "👀", count: 1 },
      { comment_id: "a", emoji: "😢", count: 1 },
    ]);
    assert.deepEqual(Object.keys(grouped.a), ["😆", "😢", "👀", "🎨"]);
  });

  test("drops zero counts and unknown emoji, and a comment left with nothing", () => {
    const grouped = groupReactions([
      { comment_id: "a", emoji: "👍", count: 0 },
      { comment_id: "a", emoji: "🔥", count: 5 },
      { comment_id: "b", emoji: "👍", count: 2 },
    ]);
    assert.deepEqual(grouped, { b: { "👍": 2 } });
  });

  test("returns an empty object for no rows", () => {
    assert.deepEqual(groupReactions([]), {});
  });

  test("does not report counts above 99 as capped (capping is display-only)", () => {
    assert.equal(groupReactions([{ comment_id: "a", emoji: "👍", count: 250 }]).a["👍"], 250);
  });
});
