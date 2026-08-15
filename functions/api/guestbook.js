import {
  json,
  errorJson,
  hashIp,
  parseSubmission,
  isRateLimited,
  getClientIp
} from "../_lib/comments.js";

// GET /api/guestbook -- list approved guestbook entries, newest first.
export async function onRequestGet({ env }) {
  const { results } = await env.personal_site_comments.prepare(
    `SELECT id, author_name, author_email, body, created_at
     FROM comments
     WHERE kind = 'guestbook' AND approved = 1
     ORDER BY created_at DESC`
  ).all();

  return json(results ?? []);
}

// POST /api/guestbook -- sign the guestbook.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorJson("Invalid JSON body.", 400);
  }

  const parsed = parseSubmission(body, { requireQuote: false, requireBody: false });
  if (!parsed.ok) return errorJson(parsed.error, 400);

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT || "dev-salt");

  if (await isRateLimited(env.personal_site_comments, ipHash)) {
    return errorJson("Too many entries -- please slow down.", 429);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.personal_site_comments.prepare(
    `INSERT INTO comments
       (id, kind, post_slug, author_name, author_email, body, created_at, approved, ip_hash)
     VALUES (?, 'guestbook', NULL, ?, ?, ?, ?, 1, ?)`
  )
    .bind(id, parsed.value.name, parsed.value.email, parsed.value.body || "", createdAt, ipHash)
    .run();

  return json(
    {
      id,
      author_name: parsed.value.name,
      author_email: parsed.value.email,
      body: parsed.value.body || "",
      created_at: createdAt
    },
    201
  );
}
