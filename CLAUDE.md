# CLAUDE.md

## Instructions from User

- Do not modify this section. You can modify other sections below the horizontal rule.
- Please update sections below after adding any new functionality, testing or design decisions to this website.
- Please allow the user to run the server locally (`npm run build` and `npm run dev`) instead of running it yourself. Check with the user if they have it running before running any relevant commands or checks.
- Please hold off from changing `README.md`, but instead inform the user if any changes need to be made there.
- Please do not read any of the files in the `./content` submodule unless explicitly instructed to by the user.
- Similarly to the previous point, please do not read any of the files in `_site\posts` or `_site\content\images`.

---

## Site design

Minimal, elegant, bookish, nostalgic — EB Garamond throughout, warm cream/tan
palette. Fonts are self-hosted (`assets/fonts/`, regular + italic variable
files, weights 400–700) rather than pulled from Google Fonts, to avoid
sending visitor IPs to Google.

Palette (full list in `:root`, `assets/css/main.css`): background `#eadbcb`,
text `#000000`, links `#1155cc`; blockquotes background `#fff2cc`, border
`#cbb99e`, text `#1b1b1a`.

Header/footer share one nav (`_includes/nav.html`): `home / posts /
guestbook`, diamond-separated; footer adds `rss` / `colophon`. A `rough
notes` link exists behind a `show_notes` param nothing currently passes
`true` (see commit `c0ca090`) — `/notes/` still works, just isn't linked. No
copyright line, by design.

## Site architecture

Jekyll static site on Cloudflare Pages. Comments and the guestbook are
backed by a Cloudflare Pages Function + D1 (SQLite), since Jekyll can't
accept submissions at request time.

### Content model

Posts, notes, and images live in a separate
[personal-site-content](https://github.com/Khasir/personal-site-content)
repo, mounted as a git submodule at `./content` (`collections_dir: content`
in `_config.yml`). Clone with `--recurse-submodules`, or `git submodule
update --init` after a normal clone; `git submodule update` after pulling to
pick up content changes.

- `content/_posts/*.md` — posts, permalink `/posts/:title/`
- `content/_notes/*.md` — rougher notes, permalink `/notes/:title/`
- `content/images/` — images referenced from posts/notes

Shared frontmatter:

```yaml
---
title: "Post title"
subtitle: "One-line subtitle, also shown in list views (optional)."
post_date: 2026-08-09
modified_date: 2026-08-12   # optional, shown as "updated ..." if present
tags: [optional, list]
---
```

`post_date` drives sort order (`_posts` falls back to the filename date;
`_notes` has no fallback — set it explicitly). `hidden: true` excludes a
post/note from `/posts/`, `/notes/`, and the homepage's recent list, but it's
still reachable by direct link. `tags` drives an auto-generated
`/tags/:tag-slug/` page per tag (`_plugins/tag_pages.rb`, template
`_layouts/tag.html` loaded via `read_yaml`), newest-first across both
collections; each tag in `entry.html`'s meta line links there.

Within a post/note body:

- **Images**: `{% include figure.html src="..." alt="..." caption="..." align="left|right|center" width="320px" %}` —
  click for full-screen. `caption` is inline-markdown (footnotes merge into
  the post's numbering); the lightbox caption strips footnote markers
  (`_plugins/strip_footnotes.rb`); `alt` stays plain text.
- **Footnotes**: standard kramdown (`text[^1]` / `[^1]: note`), with
  hover/focus preview.
- **Comments**: on by default (`comments: false` to disable); no account
  needed. Also enabled on the homepage/`/posts/`/`/notes/`, scoped to each
  page's intro copy (`.entry-content`) with the page URL as thread key.
  Standalone `layout: page` pages need `comments: true` explicitly;
  `assets/js/comments.js` no-ops if `.entry-content` isn't present.
- **Titles/dates**: lowercased via CSS (and via inline script for
  `<title>`, kept out of jekyll-seo-tag's `og:title`/JSON-LD). Meta line
  reads `p. <date>` / `l.m. <date>` (posted/modified).
- **Link previews**: `og:description`/`twitter:description` use a
  `link_preview` frontmatter field if present (`_plugins/seo_description.rb`),
  else the opening paragraph.
- **External links** auto-open in a new tab with an arrow
  (`assets/js/external-links.js`, by hostname).
- **Quote attribution**: `> Quote.\n>\n> — Someone\n> {: .attribution}`
- **Expansion sections**: native `<details>`/`<summary>`, needs
  `markdown="1"` for markdown inside.

### Password-protected ("encrypted") posts

A post/note can be gated behind a shared passphrase — listed and linkable
normally, but the body unreadable without it. This is casual gatekeeping
among people the author knows, not real access control (no accounts, no
server-side check, no resistance to a determined attacker).

- **Client-side encryption, not a server check**: the site is fully static
  and the `content` submodule is public, so a server-side password check
  would still leave plaintext in that repo's history. Instead the body is
  encrypted (AES-256-GCM, key via PBKDF2-SHA256/600k iterations,
  `scripts/lib/encrypted-post-crypto.js`) locally before commit, via `npm
  run encrypt-post -- <source.md> <dest.md>`, against a plaintext draft kept
  outside `content/`. Passphrase lives only in local shell env
  (`ENCRYPTED_POST_PASSWORD`) — never in Cloudflare config or read by the
  build. `npm run decrypt-post -- <encrypted.md> <dest.md>` reverses this for
  editing; re-run `encrypt-post` afterward (fresh salt/iv each time).
- Script writes `encrypted: true` +
  `encrypted_salt`/`encrypted_iv`/`encrypted_data` (base64) to frontmatter,
  keeps public fields (`title`, `tags`, `link_preview`) as-is, leaves body
  empty. `_layouts/entry.html` renders *only* the password form for
  `page.encrypted` (no `{{ content }}`).
- Real body never passes through kramdown/Liquid, so only a small hand-rolled
  markdown subset is supported (paragraphs, bold, italic, links —
  `renderSubsetMarkdown()` in `assets/js/encrypted-post.js`). No
  images/footnotes/includes in encrypted posts.
- **Unlock UI**: `_layouts/entry.html` renders a password form plus a hidden
  `.entry-content` container carrying the base64 salt/iv/ciphertext as data
  attributes when `page.encrypted` is set. Password input is `type="text"`
  (deliberate — this isn't a login, nothing is transmitted either way, so
  there's no server-side exposure to mask against; only tradeoff is
  shoulder-surfing). `assets/js/encrypted-post.js` (loaded unconditionally
  like the other `assets/js/*.js` files, no-ops if `[data-encrypted-post]`
  isn't present) derives the key via `crypto.subtle` and attempts AES-GCM
  decryption on submit; GCM's auth tag makes a wrong password fail outright.
  No network request either way, so no rate limit applies — passphrase
  strength and PBKDF2 cost are the real defenses.
- **Decrypted content must opt back into load-time-only behavior**:
  `external-links.js` exposes `window.wireExternalLinks(root)`, and
  `comments.js` exposes `window.refreshCommentHighlights()`, both called by
  `encrypted-post.js` after revealing content (otherwise links aren't wired
  and existing comments never anchor, since `.entry-content` was empty at
  initial render).
- `feed.xml` forces `excerpt_only` for `post.encrypted` (empty `<content>`,
  only `<summary>` from `link_preview`). List pages needed no changes.
- **Known caveat**: comments stay on by default for encrypted posts, so a
  reader could quote decrypted text into the public `comments` table.
  Not yet addressed; likely fix is disabling comments by default for
  `page.encrypted` unless overridden.

### Comments & guestbook architecture

Both backed by the same `comments` D1 table (`functions/`), split by a
`kind` column.

- **Instant, no moderation queue** — live as soon as POSTed. Guarded only by
  a honeypot field and a per-IP rate limit (5/60s, 25/day, salted hash —
  `functions/_lib/comments.js`); no CAPTCHA yet, but the path allows one.
- **Hourly email digest** — see below.
- **Overlapping highlights**: overlapping comment ranges are re-partitioned
  into non-overlapping `<mark>` segments each tagged with every covering
  comment (`renderAll()` in `assets/js/comments.js`), since wrapping ranges
  independently corrupts markup. Most-recently-posted comment is "primary"
  on overlap; a highlight's reply reuses that anchor.
- **Text anchoring**: quote + prefix/suffix context match (simplified
  Hypothes.is-style), falling back to bare quote search. No match = dropped
  from inline view (stays in DB).

### Comment notification digest

A separate Cloudflare Worker (`workers/comment-notifier/`, since Pages
Functions can't run on a schedule) runs hourly via Cron, checks `comments`
for anything new since its last run, and emails a plain-text digest via
[Resend](https://resend.com):

```
New activity in the last hour:

- my-post-slug: 3 new comments
- another-post: 1 new comment
- home: 1 new comment
- guestbook: 2 new entries
```

Nothing sent if no new activity.

- State is one `last_notified_at` row (`notification_state` table,
  `migrations/0003_notification_state.sql`) rather than a per-comment flag
  — one write per run.
- No links in the email (slug alone doesn't disambiguate `_posts`/`_notes`,
  and could be wrong). Homepage's `post_slug` (`/`) displays as "home".
- A failed Resend send doesn't advance `last_notified_at` — retries next run.

`NOTIFY_TO_EMAIL`, `NOTIFY_FROM_EMAIL`, `NOTIFY_FROM_NAME`,
`RESEND_API_KEY` are secrets (not `vars`) — locally via
`workers/comment-notifier/.dev.vars`, deployed via `wrangler secret put`.

**Local dev**: `notifier:local` uses `--persist-to=.wrangler/state`, same as
`site:local`, sharing the local D1.

```bash
cp workers/comment-notifier/.dev.vars.example workers/comment-notifier/.dev.vars   # first time only
npm test                # covers workers/comment-notifier/tests/lib.test.js too
npm run notifier:local  # wrangler dev --test-scheduled, sharing the main site's local D1
```

Hit `http://localhost:<port>/__scheduled` to trigger the scheduled handler
manually.

**Logging**: `src/index.js` logs each step, prefixed `[comment-notifier]`.
`wrangler.jsonc` sets `observability.enabled: true` so logs show in
`wrangler tail`/dashboard (without it only raw cron metadata surfaces).

**Deploy**: set up a sender in Resend, then from `workers/comment-notifier/`
run `wrangler secret put RESEND_API_KEY`/`NOTIFY_TO_EMAIL`/
`NOTIFY_FROM_EMAIL`/`NOTIFY_FROM_NAME` (repeat with `--env preview` for dev),
then `npm run notifier:deploy:dev` / `notifier:deploy:prod`.

Deployment scope (as of writing):

| Environment | Site hosting | D1 database | Notifier deployed? |
| --- | --- | --- | --- |
| Local | `npm run build` + `npm run site:local` | local D1 (`.wrangler/state`) | Runs via `npm run notifier:local` against the same local D1 |
| Dev (`dev` branch) | Cloudflare Pages preview | `personal-site-comments-dev` | **Not deployed** |
| Prod (`main` branch) | Cloudflare Pages production | `personal-site-comments` | **Deployed and live**, hourly |

### Crawling / scraping stance

`robots.txt` (blanket `Disallow: /`) and `llms.txt` (AI training opt-out) are
intentional — meant to be shared link-to-link, not indexed/crawled.
`jekyll-sitemap` was deliberately removed for the same reason. Keep this in
mind before adding anything SEO/discoverability-oriented. Both are
honor-system only; Cloudflare's dashboard "block AI bots" toggle would add
real enforcement but isn't turned on (account setting, not a repo change).

### Current status

- Connected to Cloudflare Pages, auto-deploying on push to `main` (prod) and
  `dev` (own preview URL) — confirm this still matches the Pages dashboard.
- No custom domain yet — `*.pages.dev`.
- `content/` submodule is public; Cloudflare fetches it automatically —
  confirm it's non-empty in the build log after any migration.
- `IP_HASH_SALT` build check wired up for `main` (`node scripts/check-env.js
  && jekyll build`) so a deploy fails rather than using the insecure default
  salt. Confirmed for `main`; double-check `dev`/preview too.
- `comment-notifier` Worker deployed to prod only (hourly Cron against prod
  D1); not yet deployed for dev.
- Homepage hit counter (`_layouts/home.html`) only renders when
  `jekyll.environment == "production"`, so local builds don't increment it.
  Driven by `JEKYLL_ENV = "production"` under `[env.production.vars]` in
  `wrangler.toml` — the Pages dashboard no longer accepts plain-text env
  vars for this project ("managed through wrangler.toml"), only secrets. Not
  set for `dev`/preview, so it stays off there too.
- Since dashboard text vars are no longer accepted, double-check
  `RUBY_VERSION=3.2.10` (previously set as a dashboard Text var per
  Deployment steps below) still applies to the `main` build — it likely
  needs to move into `wrangler.toml` (`[env.production.vars]`) too, or the
  build may be running against a different default Ruby version now.

### Local development

Requires Ruby/Bundler (Jekyll) and Node (Wrangler/Pages Functions).

```bash
git submodule update --init   # first time only, pulls in ./content
bundle install
npm install
```

```bash
# Terminal 1 — rebuilds _site/ on change
npm run build
```

```bash
# Terminal 2 — serves _site/ and /api/* together, with a local D1 database
cp .dev.vars.example .dev.vars   # first time only
npm run d1:migrate:local          # first time only, and after schema changes
npm run site:local
```

Open the URL Wrangler prints (typically http://localhost:8788).

**Gotchas:**
- `npm run build` doesn't reload `_config.yml` — restart after editing site
  title, plugins, etc.
- If `wrangler pages dev` starts returning `D1_ERROR: no such table` after
  working fine, check for a second `wrangler pages dev` process bound to
  the same port — each resolves its local D1 slightly differently. Kill the
  extras and restart.

### Testing

`npm test` runs both layers:

- **Unit** (`tests/unit/`, Node's test runner) — validation/rate-limit/
  hashing in `functions/_lib/comments.js`, plus the encrypt/decrypt
  round-trip in `scripts/lib/encrypted-post-crypto.js` (via Node's
  `crypto.webcrypto`). `npm run test:unit`.
- **E2E** (`tests/e2e/`, Playwright + Chromium) — things that only break
  with a real browser's Range/CSS engine: nested `<mark>`s from overlapping
  comments, selections crossing block boundaries, popover dismissal.
  `other-pages-comments.spec.js` covers homepage/`/posts/`/`/notes/`
  threads; `encrypted-post.spec.js` covers the unlock flow (no plaintext in
  served HTML, wrong/correct password, markdown subset, external links) plus
  a regression case for `window.refreshCommentHighlights()`, against a
  throwaway fixture post (`tests/e2e/fixtures/setup-encrypted-fixture.js`
  writes it into `content/_posts/` before build; `global-teardown.js`
  deletes it — never committed, since `content` is public). `npm run
  test:e2e` builds the site, wipes/re-migrates a dedicated local D1
  (`.wrangler-test/`), and serves on port 8799. Each test sets its own fake
  `CF-Connecting-IP` (`fakeIp()` in `helpers.js`) so the shared rate limiter
  doesn't trip between tests.

Debugging: `npx playwright test --ui`, or `npx playwright show-trace <path>`
on a saved trace (`test-results/`).

### Deployment steps taken

Merges to `main` and other branches auto-deploy.

**Prod**: created D1 via `npx wrangler d1 create personal-site-comments`
(values into `wrangler.toml`); `npm run d1:migrate:prod`; connected repo as
a Cloudflare Pages project (Compute → Workers and Pages → Create
application → Pages → Continue with GitHub) with framework preset Jekyll,
build command `node scripts/check-env.js && jekyll build`, output `_site`,
env vars Secret `IP_HASH_SALT` + Text `RUBY_VERSION=3.2.10`; auto-deploy
enabled only for `main`.

**Dev**: created dev D1 via `npx wrangler d1 create
personal-site-comments-dev` (values under `[[env.preview.d1_databases]]`);
`npm run d1:migrate:dev`.
