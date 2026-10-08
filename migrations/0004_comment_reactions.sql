-- Emoji reaction counts per comment. A plain counter (no per-visitor rows):
-- each browser remembers its own reactions in localStorage.
CREATE TABLE IF NOT EXISTS comment_reactions (
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (comment_id, emoji)
);
