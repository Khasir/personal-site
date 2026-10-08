import {
  json,
  errorJson,
  hashIp,
  parseSubmission,
  isRateLimited,
  getClientIp
} from "../_lib/comments.js";
import { groupReactions } from "../_lib/reactions.js";

// GET /api/comments?slug=<post-slug> -- list approved comments for a post.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  if (!slug) return errorJson("Missing slug.", 400);

  const db = env.personal_site_comments;
  const [{ results }, { results: reactionRows }] = await Promise.all([
    db
      .prepare(
        `SELECT id, author_name, body, quote, prefix, suffix, created_at
         FROM comments
         WHERE kind = 'comment' AND post_slug = ? AND approved = 1
         ORDER BY created_at ASC`
      )
      .bind(slug)
      .all(),
    db
      .prepare(
        `SELECT r.comment_id, r.emoji, r.count
         FROM comment_reactions r
         JOIN comments c ON c.id = r.comment_id
         WHERE c.kind = 'comment' AND c.post_slug = ? AND c.approved = 1 AND r.count > 0`
      )
      .bind(slug)
      .all()
  ]);

  const reactions = groupReactions(reactionRows ?? []);
  return json((results ?? []).map((c) => ({ ...c, reactions: reactions[c.id] ?? {} })));
}

// POST /api/comments -- create a new comment anchored to a text selection.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorJson("Invalid JSON body.", 400);
  }

  const postSlug = typeof body.post_slug === "string" ? body.post_slug.trim() : "";
  if (!postSlug) return errorJson("Missing post_slug.", 400);

  const parsed = parseSubmission(body, { requireQuote: true });
  if (!parsed.ok) return errorJson(parsed.error, 400);

  const ip = getClientIp(request);
  const ipHash = await hashIp(ip, env.IP_HASH_SALT || "dev-salt");

  if (await isRateLimited(env.personal_site_comments, ipHash)) {
    return errorJson("Please slow down.", 429);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await env.personal_site_comments.prepare(
    `INSERT INTO comments
       (id, kind, post_slug, author_name, body, quote, prefix, suffix, created_at, approved, ip_hash)
     VALUES (?, 'comment', ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  )
    .bind(
      id,
      postSlug,
      parsed.value.name,
      parsed.value.body,
      parsed.value.quote,
      parsed.value.prefix,
      parsed.value.suffix,
      createdAt,
      ipHash
    )
    .run();

  return json(
    {
      id,
      author_name: parsed.value.name,
      body: parsed.value.body,
      quote: parsed.value.quote,
      prefix: parsed.value.prefix,
      suffix: parsed.value.suffix,
      created_at: createdAt,
      reactions: {}
    },
    201
  );
}
