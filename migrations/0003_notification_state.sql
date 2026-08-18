-- Tracks the last time the comment-notifier Worker sent a digest email, so
-- it knows the window of "new" rows to check on its next hourly run.
CREATE TABLE IF NOT EXISTS notification_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),  -- single row
  last_notified_at TEXT NOT NULL
);
