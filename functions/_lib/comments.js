// Shared helpers for the comments/guestbook Pages Functions.
// Files/dirs prefixed with "_" under /functions are not routable by
// Cloudflare Pages -- this is intentionally just a library module.

const MAX_NAME_LEN = 80;
const MAX_BODY_LEN = 1000;
const MAX_QUOTE_LEN = 500;
const MAX_EMAIL_LEN = 254;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  });
}

export function errorJson(message, status = 400) {
  return json({ error: message }, status);
}

export async function hashIp(ip, salt) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(salt + ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Trims to a max length and collapses to null if empty.
function cleanString(value, maxLen) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length ? trimmed : null;
}

// Length-caps without trimming. Unlike name/body/quote, prefix/suffix are
// exact surrounding-text context captured for re-anchoring a comment on
// the page -- trimming them corrupts that whenever the boundary sits next
// to whitespace (i.e. almost always, since words are separated by spaces),
// making prefix+quote+suffix no longer match the real text and silently
// falling back to a same-word match anywhere else in the post.
function cleanContext(value, maxLen) {
  if (typeof value !== "string") return "";
  return value.slice(0, maxLen);
}

/**
 * Parses and validates a comment/guestbook submission payload.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parseSubmission(body, { requireQuote, requireBody = true }) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }

  // Honeypot: real visitors never fill this in.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return { ok: false, error: "Rejected." };
  }

  const name = cleanString(body.name, MAX_NAME_LEN);
  const text = cleanString(body.body, MAX_BODY_LEN);
  if (!name || (requireBody && !text)) {
    return { ok: false, error: requireBody ? "Name and comment are required." : "Name is required." };
  }

  const quote = cleanString(body.quote, MAX_QUOTE_LEN);
  if (requireQuote && !quote) {
    return { ok: false, error: "Missing highlighted text to attach the comment to." };
  }

  const email = cleanString(body.email, MAX_EMAIL_LEN);
  const prefix = cleanContext(body.prefix, 64);
  const suffix = cleanContext(body.suffix, 64);

  return {
    ok: true,
    value: { name, body: text, email, quote: quote || null, prefix, suffix }
  };
}

/**
 * Rejects if the given ip_hash has posted more than the allowed number of
 * times in the current rate-limit window. Best-effort only -- this is a
 * simple deterrent, not a substitute for proper abuse protection (e.g.
 * Cloudflare rate limiting rules or Turnstile) if spam becomes a problem.
 */
export async function isRateLimited(db, ipHash) {
  if (!ipHash) return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString();
  const row = await db
    .prepare("SELECT COUNT(*) AS n FROM comments WHERE ip_hash = ? AND created_at > ?")
    .bind(ipHash, since)
    .first();
  return (row?.n ?? 0) >= RATE_LIMIT_MAX_PER_WINDOW;
}

export function getClientIp(request) {
  return request.headers.get("CF-Connecting-IP") || "0.0.0.0";
}
