CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('comment', 'guestbook')),
  post_slug TEXT,               -- NULL for guestbook entries
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  quote TEXT,                   -- highlighted text (comments only)
  prefix TEXT,                  -- context before the quote, for re-anchoring
  suffix TEXT,                  -- context after the quote, for re-anchoring
  created_at TEXT NOT NULL,     -- ISO 8601
  approved INTEGER NOT NULL DEFAULT 1,
  ip_hash TEXT                  -- salted hash, spam/rate-limit use only
);

CREATE INDEX IF NOT EXISTS idx_comments_post_slug ON comments (post_slug);
CREATE INDEX IF NOT EXISTS idx_comments_kind_created ON comments (kind, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_ip_hash_created ON comments (ip_hash, created_at);
