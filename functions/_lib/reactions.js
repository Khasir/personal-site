// Shared helpers for the emoji-reactions Pages Function. Keep REACTION_EMOJIS
// in sync with REACTIONS in assets/js/comments.js (same emoji, same order).

export const REACTION_EMOJIS = ["👍", "💖", "😆", "😢", "👀", "🎉", "🎨"];
const REACTION_ACTIONS = ["add", "remove"];
const MAX_COMMENT_ID_LEN = 64;

/**
 * Parses and validates a reaction request body.
 * Returns { ok: true, value: { commentId, emoji, action } } or { ok: false, error }.
 */
export function parseReaction(body) {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid request body." };
  }

  const commentId = typeof body.comment_id === "string" ? body.comment_id.trim() : "";
  if (!commentId || commentId.length > MAX_COMMENT_ID_LEN) {
    return { ok: false, error: "Missing comment_id." };
  }
  if (!REACTION_EMOJIS.includes(body.emoji)) {
    return { ok: false, error: "Unsupported emoji." };
  }
  if (!REACTION_ACTIONS.includes(body.action)) {
    return { ok: false, error: "Action must be 'add' or 'remove'." };
  }

  return { ok: true, value: { commentId, emoji: body.emoji, action: body.action } };
}

/**
 * Groups comment_reactions rows into { [commentId]: { [emoji]: count } },
 * dropping zero counts and unknown emoji, with each comment's emoji in
 * REACTION_EMOJIS order regardless of row order.
 */
export function groupReactions(rows) {
  const byComment = {};
  for (const row of rows) {
    if (!REACTION_EMOJIS.includes(row.emoji) || !(row.count > 0)) continue;
    (byComment[row.comment_id] ??= {})[row.emoji] = row.count;
  }

  const ordered = {};
  for (const [commentId, counts] of Object.entries(byComment)) {
    ordered[commentId] = {};
    for (const emoji of REACTION_EMOJIS) {
      if (emoji in counts) ordered[commentId][emoji] = counts[emoji];
    }
  }
  return ordered;
}
