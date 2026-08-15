# Outstanding tasks

Status snapshot as of 2026-08-10. See [README.md](../README.md) for how the
site is built; this is just what's left to do.

## Before going live

- ~~Deploy~~ Done — connected to Cloudflare Pages, auto-deploys on push to
  `main` and `dev`. See the README's "Deployment steps taken" section.
- ~~Fix the D1 binding name mismatch.~~ Done — `functions/api/comments.js`
  and `functions/api/guestbook.js` now read `env.personal_site_comments`,
  matching `wrangler.toml`. Confirmed working both locally and in prod
  (pushed to `main`).
- **Pick a domain.** Until then the site runs on the free `*.pages.dev`
  subdomain.

## Deferred

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
