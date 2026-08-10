// Shared helpers for the Playwright E2E suite.

// Runs in the browser: builds a flat text index over .entry-content's text
// nodes, finds `needle` with whitespace collapsed to \s+ (so tests aren't
// tied to exactly where the markdown source happens to wrap lines), and
// selects the match via the real Selection/Range APIs before firing the
// mouseup event comments.js listens for.
/* eslint-disable no-undef */
function browserSelectMatch(pattern) {
  const article = document.querySelector(".entry-content");
  const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
  const nodes = [];
  let text = "";
  let node;
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: text.length });
    text += node.nodeValue;
  }

  function pointAt(offset) {
    for (let i = nodes.length - 1; i >= 0; i--) {
      if (offset >= nodes[i].start) return { node: nodes[i].node, offset: offset - nodes[i].start };
    }
    return null;
  }

  const re = new RegExp(pattern);
  const m = re.exec(text);
  if (!m) return false;

  const start = pointAt(m.index);
  const end = pointAt(m.index + m[0].length);
  if (!start || !end) return false;

  const range = document.createRange();
  range.setStart(start.node, start.offset);
  range.setEnd(end.node, end.offset);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
  return true;
}
/* eslint-enable no-undef */

function toWhitespaceInsensitivePattern(phrase) {
  return phrase
    .trim()
    .split(/\s+/)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
}

/** Selects the first occurrence of `needle` (whitespace-insensitive) within
 * `.entry-content` and fires the mouseup event comments.js listens for. */
export async function selectText(page, needle) {
  const found = await page.evaluate(
    `(${browserSelectMatch.toString()})(${JSON.stringify(toWhitespaceInsensitivePattern(needle))})`
  );
  if (!found) throw new Error(`selectText: could not find "${needle}" in .entry-content`);
}

/** Selects from the first occurrence of `startNeedle` through the end of
 * the first occurrence of `endNeedle` (which must come after it), for
 * testing selections that cross element/block boundaries. */
export async function selectAcross(page, startNeedle, endNeedle) {
  const pattern =
    toWhitespaceInsensitivePattern(startNeedle) + "[\\s\\S]*?" + toWhitespaceInsensitivePattern(endNeedle);
  const found = await page.evaluate(`(${browserSelectMatch.toString()})(${JSON.stringify(pattern)})`);
  if (!found) throw new Error(`selectAcross: could not find "${startNeedle}" ... "${endNeedle}"`);
}

/** A short unique-ish string so repeated test runs against the same
 * persistent local D1 database don't collide with earlier runs' data. */
export function uniqueTag() {
  return `t${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

/** A plausible-looking but fake IPv4 address. Locally, nothing sets
 * CF-Connecting-IP the way Cloudflare's edge does in production, so every
 * request would otherwise share one rate-limit bucket. Tests set this
 * header directly (see comments.spec.js/guestbook.spec.js) so each test
 * gets its own bucket instead of tripping over the others' writes -- this
 * doesn't bypass anything real, since production ignores whatever a client
 * sends here and stamps its own value at the edge. */
export function fakeIp() {
  const octet = () => Math.floor(Math.random() * 255) + 1;
  return `10.${octet()}.${octet()}.${octet()}`;
}
