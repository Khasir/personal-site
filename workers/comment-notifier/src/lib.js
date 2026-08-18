// Pure logic for the hourly comment digest -- no D1/network access, so it's
// easy to unit test. Mirrors the functions/_lib/comments.js split.

/**
 * Groups new comment/guestbook rows for a digest.
 * @param {{ kind: string, post_slug: string | null }[]} rows
 * @returns {{ byPostSlug: { post_slug: string, count: number }[], guestbookCount: number }}
 */
export function groupNewComments(rows) {
  const counts = new Map();
  let guestbookCount = 0;

  for (const row of rows) {
    if (row.kind === "guestbook") {
      guestbookCount += 1;
      continue;
    }
    counts.set(row.post_slug, (counts.get(row.post_slug) ?? 0) + 1);
  }

  const byPostSlug = Array.from(counts.entries())
    .map(([post_slug, count]) => ({ post_slug, count }))
    .sort((a, b) => b.count - a.count);

  return { byPostSlug, guestbookCount };
}

/**
 * Builds the digest email subject/body, or null if there's nothing to send.
 * @param {{ byPostSlug: { post_slug: string, count: number }[], guestbookCount: number }} grouped
 * @returns {{ subject: string, text: string } | null}
 */
export function buildEmailBody({ byPostSlug, guestbookCount }) {
  const commentTotal = byPostSlug.reduce((sum, g) => sum + g.count, 0);
  if (commentTotal === 0 && guestbookCount === 0) return null;

  const subjectParts = [];
  if (commentTotal > 0) {
    const pageWord = byPostSlug.length === 1 ? "page" : "pages";
    subjectParts.push(
      `${commentTotal} new comment${commentTotal === 1 ? "" : "s"} across ${byPostSlug.length} ${pageWord}`
    );
  }
  if (guestbookCount > 0) {
    subjectParts.push(
      `${guestbookCount} new guestbook ${guestbookCount === 1 ? "entry" : "entries"}`
    );
  }
  const subject = subjectParts.join(" + ");

  const lines = byPostSlug.map(
    (g) => `- ${g.post_slug === "/" ? "home" : g.post_slug}: ${g.count} new comment${g.count === 1 ? "" : "s"}`
  );
  if (guestbookCount > 0) {
    lines.push(`- guestbook: ${guestbookCount} new ${guestbookCount === 1 ? "entry" : "entries"}`);
  }

  const text = `New activity in the last hour:\n\n${lines.join("\n")}`;

  return { subject, text };
}

/**
 * Builds the Resend "from" header, e.g. "Name <email@example.com>" -- or
 * just the bare email if no display name is set.
 * @param {string} fromEmail
 * @param {string | undefined | null} fromName
 * @returns {string}
 */
export function buildFromHeader(fromEmail, fromName) {
  return fromName ? `${fromName} <${fromEmail}>` : fromEmail;
}
