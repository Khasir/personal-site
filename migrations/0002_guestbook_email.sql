-- Optional email address for guestbook entries (shown publicly next to the
-- entry). Comments never set this column.
ALTER TABLE comments ADD COLUMN author_email TEXT;
