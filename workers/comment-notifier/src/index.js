import { groupNewComments, buildEmailBody, buildFromHeader } from "./lib.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

async function getLastNotifiedAt(db, scheduledTime) {
  const row = await db
    .prepare("SELECT last_notified_at FROM notification_state WHERE id = 1")
    .first();
  if (row?.last_notified_at) return row.last_notified_at;
  return new Date(scheduledTime - ONE_HOUR_MS).toISOString();
}

async function setLastNotifiedAt(db, isoTimestamp) {
  await db
    .prepare(
      `INSERT INTO notification_state (id, last_notified_at)
       VALUES (1, ?)
       ON CONFLICT (id) DO UPDATE SET last_notified_at = excluded.last_notified_at`
    )
    .bind(isoTimestamp)
    .run();
}

async function sendDigestEmail(env, { subject, text }) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      from: buildFromHeader(env.NOTIFY_FROM_EMAIL, env.NOTIFY_FROM_NAME),
      to: env.NOTIFY_TO_EMAIL,
      subject,
      text
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Resend send failed: ${response.status} ${detail}`);
  }
}

export default {
  async scheduled(event, env, ctx) {
    const db = env.personal_site_comments;
    const runAt = new Date(event.scheduledTime).toISOString();

    const since = await getLastNotifiedAt(db, event.scheduledTime);

    const { results } = await db
      .prepare(
        "SELECT kind, post_slug FROM comments WHERE approved = 1 AND created_at > ?"
      )
      .bind(since)
      .all();

    const grouped = groupNewComments(results ?? []);
    const email = buildEmailBody(grouped);

    if (email) {
      await sendDigestEmail(env, email);
    }

    await setLastNotifiedAt(db, runAt);
  }
};
