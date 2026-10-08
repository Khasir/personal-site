import { json, errorJson } from "../_lib/comments.js";
import { parseReaction } from "../_lib/reactions.js";

// POST /api/reactions -- add or remove one emoji reaction on a comment.
// Body: { comment_id, emoji, action: "add" | "remove" }.
// Responds with the new total for that comment + emoji.
// 
// Guestbook entries can't be reacted to. There is no per-visitor dedupe here -
// browsers track their own reactions in localStorage.
export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return errorJson("Invalid JSON body.", 400);
  }

  const parsed = parseReaction(body);
  if (!parsed.ok) return errorJson(parsed.error, 400);
  const { commentId, emoji, action } = parsed.value;

  const db = env.personal_site_comments;

  const comment = await db
    .prepare("SELECT id FROM comments WHERE id = ? AND kind = 'comment' AND approved = 1")
    .bind(commentId)
    .first();
  if (!comment) return errorJson("Comment not found.", 404);

  if (action === "add") {
    await db
      .prepare(
        `INSERT INTO comment_reactions (comment_id, emoji, count) VALUES (?, ?, 1)
         ON CONFLICT (comment_id, emoji) DO UPDATE SET count = count + 1`
      )
      .bind(commentId, emoji)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE comment_reactions SET count = MAX(count - 1, 0)
         WHERE comment_id = ? AND emoji = ?`
      )
      .bind(commentId, emoji)
      .run();
  }

  const row = await db
    .prepare("SELECT count FROM comment_reactions WHERE comment_id = ? AND emoji = ?")
    .bind(commentId, emoji)
    .first();

  return json({ comment_id: commentId, emoji, count: row?.count ?? 0 });
}
