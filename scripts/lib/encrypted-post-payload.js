// Encrypted post payload format:
//    { v: 2, "markdown": string, "html": string }
// assets/js/encrypted-post.js reads the same shape.
export const PAYLOAD_VERSION = 2;

export function buildPayload(markdown, html) {
  return JSON.stringify({ v: PAYLOAD_VERSION, markdown, html });
}

// Anything that isn't a v2 payload is treated as a v1 raw markdown body 
// so decrypting and re-encrypting an old post migrates it
export function parsePayload(plaintext) {
  try {
    const data = JSON.parse(plaintext);
    if (
      data &&
      data.v === PAYLOAD_VERSION &&
      typeof data.markdown === "string" &&
      typeof data.html === "string"
    ) {
      return data;
    }
  } catch {
    // not JSON -- fall through
  }
  return { v: 1, markdown: plaintext, html: null };
}

// Liquid ({% ... %} tags are is only processed by Jekyll, which never sees
// an encrypted body, so it would show up as literal text.
// Returns the offending lines (1-based) so encrypt-post.js can refuse.
export function findLiquid(markdown) {
  return markdown
    .split(/\r?\n/)
    .map((text, i) => ({ line: i + 1, text }))
    .filter(({ text }) => /\{%|\{\{/.test(text));
}
