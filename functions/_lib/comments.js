// Shared helpers for the comments/guestbook Pages Functions.
// Files/dirs prefixed with "_" under /functions are not routable by
// Cloudflare Pages -- this is intentionally just a library module.

const MAX_NAME_LEN = 80;
const MAX_BODY_LEN = 1000;
const MAX_QUOTE_LEN = 500;
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

/**
 * Parses and validates a comment/guestbook submission payload.
 * Returns { ok: true, value } or { ok: false, error }.
 */
export function parseSubmission(body, { requireQuote }) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }

  // Honeypot: real visitors never fill this in.
  if (typeof body.website === "string" && body.website.trim().length > 0) {
    return { ok: false, error: "Rejected." };
  }

  const name = cleanString(body.name, MAX_NAME_LEN);
  const text = cleanString(body.body, MAX_BODY_LEN);
  if (!name || !text) {
    return { ok: false, error: "Name and comment are required." };
  }

  const quote = cleanString(body.quote, MAX_QUOTE_LEN);
  if (requireQuote && !quote) {
    return { ok: false, error: "Missing highlighted text to attach the comment to." };
  }

  const prefix = cleanString(body.prefix, 64) || "";
  const suffix = cleanString(body.suffix, 64) || "";

  return {
    ok: true,
    value: { name, body: text, quote: quote || null, prefix, suffix }
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
