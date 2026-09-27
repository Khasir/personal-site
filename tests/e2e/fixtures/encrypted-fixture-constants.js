export const FIXTURE_PASSWORD = "e2e-test-password";
// Rendered through the real kramdown pipeline (scripts/lib/render-markdown.js)
// by setup-encrypted-fixture.js, so it exercises the same path as
// `npm run encrypt-post`.
export const FIXTURE_MARKDOWN = [
  "the secret content. **bold** and a [link](https://example.com).<!-- inline hidden note -->",
  "",
  "<!-- a hidden note",
  "",
  "spanning paragraphs -->",
  "",
  "## A heading",
  "",
  '"Smart quotes" -- a footnote[^1] and `inline code`.',
  "",
  "> A quoted line.",
  ">",
  "> — Someone",
  "> {: .attribution}",
  "",
  "1. step one",
  "2. step two",
  "   - nested bullet",
  "3. step three",
  "",
  "```js",
  "const answer = 42;",
  "```",
  "",
  "[^1]: The footnote text.",
].join("\n");
export const FIXTURE_PATH = "content/_posts/2024-01-01-e2e-encrypted-fixture.md";
export const FIXTURE_URL = "/posts/e2e-encrypted-fixture/";
