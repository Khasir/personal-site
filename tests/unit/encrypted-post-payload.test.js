import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { buildPayload, parsePayload, findLiquid } from "../../scripts/lib/encrypted-post-payload.js";

describe("encrypted-post-payload", () => {
  test("round-trips markdown and html", () => {
    const parsed = parsePayload(buildPayload("**hi**", "<p><strong>hi</strong></p>"));
    assert.deepEqual(parsed, { v: 2, markdown: "**hi**", html: "<p><strong>hi</strong></p>" });
  });

  test("treats a pre-v2 plaintext body as markdown with no html", () => {
    assert.deepEqual(parsePayload("just *markdown*"), { v: 1, markdown: "just *markdown*", html: null });
  });

  test("treats JSON that isn't a v2 payload as markdown too", () => {
    assert.deepEqual(parsePayload('{"a": 1}'), { v: 1, markdown: '{"a": 1}', html: null });
  });

  test("finds Liquid tags and output, with 1-based line numbers", () => {
    const md = 'fine\n{% include figure.html src="x" %}\nalso fine\nhello {{ page.title }}';
    assert.deepEqual(
      findLiquid(md).map(({ line }) => line),
      [2, 4]
    );
  });

  test("doesn't flag kramdown attribute lists or single braces", () => {
    assert.deepEqual(findLiquid("> — Someone\n> {: .attribution}\nconst o = { a: 1 };"), []);
  });
});
