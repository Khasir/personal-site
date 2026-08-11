# Outstanding tasks

Status snapshot as of 2026-08-10. See [README.md](README.md) for how the
site is built; this is just what's left to do.

## Before going live

- **Deploy.** Nothing's been pushed to production yet. `wrangler.toml`'s
  `database_id` is still the `REPLACE_ME` placeholder — the real first-deploy
  steps (create the production D1 database, migrate it, connect the
  Cloudflare Pages project, set the `IP_HASH_SALT` secret) haven't been run.
  See the "Deploying" section of the README.
- **Pick a domain.** Until then the site runs on the free `*.pages.dev`
  subdomain.

## Deferred, not forgotten

- **Cloudflare's dashboard-level bot-blocking controls** (including the
  one-click "block AI bots" toggle) — `robots.txt`/`llms.txt` are honor-system
  only and don't stop a scraper that ignores them; this would add real
  enforcement. Said "maybe later" when this came up.
- **Turnstile/CAPTCHA** on the comment and guestbook forms — skipped for now,
  but the submission path is structured so it can be dropped in later if
  spam becomes a problem.
- **Notifications** for new comments/guestbook signatures (email, Discord,
  etc.) — never wired up. Right now you'd only find out by checking the site
  or querying D1 directly.
- **Moderation queue** — comments/guestbook entries go live instantly with
  no review step. Deliberate speed-over-safety call while testing; worth
  revisiting once the site is actually public rather than just you testing
  it.
- **CI on PR to main**, running the test suite (`tests/unit/` +
  `tests/e2e/`, see the README's "Testing" section) before a PR can merge.

## Open design question

- Whether to keep showing post **subtitles on list pages** (`/posts/`,
  `/notes/`). The previous design only showed them on the post itself —
  hasn't been decided whether to go back to that.
