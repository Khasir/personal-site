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

Minimal, elegant, bookish, nostalgic — EB Garamond throughout, warm
cream/tan palette. Self-hosted (`assets/fonts/`, two variable-font files:
regular + italic, weights 400–700) rather than pulled from Google Fonts, to
avoid sending every visitor's IP to Google on each page load.

Palette (see `:root` in `assets/css/main.css` for the full list):
- Background `#eadbcb`, text `#000000`, links `#1155cc`
- Blockquotes: background `#fff2cc`, left border `#cbb99e`, text `#1b1b1a`

Header and footer share one nav (`_includes/nav.html`): `home / posts /
guestbook`, diamond-separated. Footer additionally shows `rss` and
`colophon` links. A `rough notes` link exists behind a `show_notes` param
that nothing currently passes `true` (commit `c0ca090`, "hide rough
notes"), so it's hidden from the nav on both — `/notes/` itself still
works, just isn't linked. No copyright line, by design.

## Site architecture

Jekyll static site on Cloudflare Pages. Comments and the guestbook are
backed by a Cloudflare Pages Function + D1 (SQLite) database, since Jekyll
can't accept submissions at request time.

### Content model

Posts, notes, and images live in a separate
[personal-site-content](https://github.com/Khasir/personal-site-content)
repo, mounted as a git submodule at `./content` (`collections_dir:
content` in `_config.yml`). Clone with `git clone --recurse-submodules`, or
`git submodule update --init` after a normal clone; run `git submodule
update` after pulling to this repo to pick up content updates.

- `content/_posts/*.md` — blog posts, permalink `/posts/:title/`
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

`post_date` drives display/sort order. `_posts` falls back to the filename
date (`YYYY-MM-DD-title.md`) if omitted; `_notes` has no fallback, so set
it explicitly.

`hidden: true` excludes a post/note from `/posts/`, `/notes/`, and the
homepage's "recent" lists — it still builds and is reachable by direct
link.

`tags` drives an auto-generated `/tags/:tag-slug/` list page per tag
(`_plugins/tag_pages.rb`, a Generator plugin; slug via Jekyll's `slugify`
filter), listing every non-hidden post/note carrying that tag, newest
first, across both collections. The template lives at `_layouts/tag.html`
and is loaded via `read_yaml` rather than a normal `layout:` reference —
the standard Jekyll pattern for generator-created pages. Each tag in
`entry.html`'s meta line links to its tag page.

Within a post/note body:

- **Images**: `{% include figure.html src="/content/images/foo.jpg" alt="..." caption="..." align="left|right|center" width="320px" %}`
  — click to view full-screen. `caption` is parsed as inline markdown
  (`markdown="span"` on `figcaption`), so footnotes work inside captions
  too and merge into the post's normal auto-numbered list. The lightbox
  caption strips footnote markers (`strip_footnote_refs` filter,
  `_plugins/strip_footnotes.rb`) since they don't make sense floating over
  the overlay; `alt` stays plain text.
- **Footnotes**: standard kramdown (`text[^1]` / `[^1]: note`). Hover/focus
  previews inline; click jumps to the note.
- **Comments**: on by default (`comments: false` to disable). Visitors
  select text to attach a comment, no account needed. Also enabled on the
  homepage, `/posts/`, `/notes/`, scoped to each page's own intro copy
  (`.entry-content` wrapping `{{ content }}`) rather than the generated
  lists — thread key is the page URL (`/`, `/posts/`, `/notes/`) instead
  of a slug. Standalone `layout: page` pages (e.g. `colophon.md`) need
  `comments: true` explicitly; `assets/js/comments.js` needs
  `.entry-content` present or it no-ops.
- **Titles/dates**: rendered lowercase via CSS `text-transform` (underlying
  text untouched); post/note `<title>` is also lowercased via an inline
  script in `_layouts/entry.html` (kept out of jekyll-seo-tag's
  `og:title`/JSON-LD, which stay properly cased). Meta line reads `p.
  <date>` / `l.m. <date>` (posted/last modified) with `<abbr>` tooltips.
- **Link previews**: `og:description`/`twitter:description` use a
  `link_preview` frontmatter field when present (`_plugins/seo_description.rb`
  sets `page["description"]` before jekyll-seo-tag renders), else fall
  back to the opening paragraph.
- **External links** auto-open in a new tab with a small arrow
  (`assets/js/external-links.js`, by hostname, no markup needed).
- **Quote attribution**:
  ```
  > Quote text.
  >
  > — Someone
  > {: .attribution}
  ```
- **Expansion sections**: native `<details>`/`<summary>`; needs
  `markdown="1"` on `<details>` for markdown to render inside.

### Comments & guestbook architecture

Both backed by the same `comments` D1 table (`functions/`), split by a
`kind` column. Deliberate choices:

- **Instant, no moderation queue** — live as soon as POSTed. Only a
  honeypot field and a per-IP rate limit (5 posts/60s, and 25 posts/day,
  salted hash — `functions/_lib/comments.js`) guard it; no Turnstile/CAPTCHA
  yet, but the path is structured to add one later.
- **Hourly email digest** of new activity — see "Comment notification
  digest" below.
- **Overlapping highlights**: when two comments' anchored ranges overlap,
  the article is re-partitioned into non-overlapping `<mark>` segments
  each tagged with every covering comment (`renderAll()` in
  `assets/js/comments.js`) — wrapping each range independently corrupted
  the markup. Hovering any segment highlights that comment's full range;
  whichever comment is most-recently-posted is "primary" where ranges
  overlap, and a highlight's "add a comment" reply reuses that anchor
  without re-selecting text.
- **Text anchoring**: quote + prefix/suffix context match (simplified
  Hypothes.is-style), falling back to a bare quote search. If neither
  matches, the comment is dropped from the inline view (stays in the DB).

### Comment notification digest

A separate Cloudflare Worker (`workers/comment-notifier/`, since Pages
Functions can't run on a schedule) runs hourly via Cron, checks the
`comments` table for anything new since its last run, and emails a
plain-text digest via [Resend](https://resend.com):

```
New activity in the last hour:

- my-post-slug: 3 new comments
- another-post: 1 new comment
- home: 1 new comment
- guestbook: 2 new entries
```

Nothing sent if no new activity. Deliberate choices:

- **State is one `last_notified_at` row** (`notification_state` table,
  `migrations/0003_notification_state.sql`) rather than a per-comment
  flag — one write per run, no migration on the hot `comments` table.
- **No links in the email** — `post_slug` is a bare slug for posts/notes
  but a full path elsewhere, and slugs alone don't say `_posts` vs
  `_notes`, so a generated link could be wrong. Exception: the homepage's
  `post_slug` (`/`) displays as "home".
- **A failed Resend send doesn't advance `last_notified_at`** — the window
  retries next run instead of silently dropping.

`NOTIFY_TO_EMAIL`, `NOTIFY_FROM_EMAIL`, `NOTIFY_FROM_NAME`,
`RESEND_API_KEY` are secrets (not `vars` in `wrangler.jsonc`) — locally via
`workers/comment-notifier/.dev.vars`, deployed via `wrangler secret put`.

#### Local dev / testing

`notifier:local` uses `--persist-to=.wrangler/state`, same as `npm run
site:local`, so it shares the local D1 — no separate migration step if
you've already run `npm run d1:migrate:local`.

```bash
cp workers/comment-notifier/.dev.vars.example workers/comment-notifier/.dev.vars   # first time only, then fill in real values
npm test                # covers workers/comment-notifier/tests/lib.test.js too
npm run notifier:local  # wrangler dev --test-scheduled, sharing the main site's local D1
```

With `notifier:local` running, hit `http://localhost:<port>/__scheduled`
to trigger the scheduled handler manually.

#### Logging

`src/index.js` logs each step (`console.log`/`console.error`, prefixed
`[comment-notifier]`): the `since` cutoff, rows found, whether a digest
sent, any failure. `wrangler.jsonc` sets `observability.enabled: true` so
these show in `wrangler tail` and the dashboard's Logs tab — without it
only raw cron metadata (e.g. `0 * * * *`) surfaces.

#### Deploy steps

1. Set up a sender in [Resend](https://resend.com) (shared test domain to
   try it, a verified domain for real use).
2. From `workers/comment-notifier/`: `wrangler secret put RESEND_API_KEY`,
   `NOTIFY_TO_EMAIL`, `NOTIFY_FROM_EMAIL`, `NOTIFY_FROM_NAME` (repeat with
   `--env preview` for the dev-DB copy too, if not just testing locally
   via `.dev.vars`).
3. `npm run notifier:deploy:dev` and/or `npm run notifier:deploy:prod` —
   or `cd workers/comment-notifier && wrangler deploy` (add `--env
   preview` for dev); Wrangler picks up `wrangler.jsonc` automatically, so
   the npm scripts' `--config` flag is only needed running from elsewhere.

#### Deployment scope (as of writing)

| Environment | Site hosting | D1 database | Notifier deployed? |
| --- | --- | --- | --- |
| Local | `npm run build` + `npm run site:local` | local D1 (`.wrangler/state`) | `npm run notifier:local` runs against the same local D1 |
| Dev (`dev` branch) | Cloudflare Pages preview deployment | `personal-site-comments-dev` | **Not deployed.** `npm run notifier:deploy:dev` exists but nothing runs it automatically |
| Prod (`main` branch) | Cloudflare Pages production deployment | `personal-site-comments` | **Deployed and live**, hourly. Deploys are manual, not tied to a branch push |

### Crawling / scraping stance

`robots.txt` (blanket `Disallow: /`) and `llms.txt` (opt-out of AI
training/scraping) are intentional — this site is meant to be shared
link-to-link, not indexed or crawled. `jekyll-sitemap` was deliberately
removed for the same reason. Keep this in mind before adding anything
SEO/discoverability-oriented.

Both are honor-system only. Cloudflare's dashboard-level bot-blocking
(incl. a one-click "block AI bots" toggle, free tier) would add real
enforcement but isn't turned on yet — an account setting, not a repo
change.

### Current status

- **Connected to Cloudflare Pages**, auto-deploying on push to `main` and
  `dev`. `main` is the production branch (main URL); `dev` gets its own
  preview URL — confirm this matches the Pages project's dashboard
  settings if it changes.
- **No custom domain yet** — runs on the free `*.pages.dev` subdomain.
- **`content/` submodule (public repo)** — Cloudflare Pages' git
  integration fetches public submodules automatically; confirm on any
  post-migration deploy that `content/` shows up with real content in the
  build log (a silently-empty submodule would build fine but ship no
  posts).
- **`IP_HASH_SALT` build check wired up for `main`** — build command runs
  `node scripts/check-env.js && jekyll build` (Settings → Builds &
  deployments), so a deploy fails instead of silently using the insecure
  default salt. Confirmed for `main`; double-check `dev`/preview picks it
  up too (Pages build commands are historically project-wide, not
  per-branch).
- **`comment-notifier` Worker deployed to prod only** — live, hourly Cron
  against prod D1. Not yet deployed for dev.

### Local development

Requires Ruby/Bundler (Jekyll) and Node (Wrangler/Pages Functions). Two
terminals:

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
# Terminal 2 — serves _site/ and the /api/* functions together, with a
# local D1 database
cp .dev.vars.example .dev.vars   # first time only
npm run d1:migrate:local          # first time only, and after schema changes
npm run site:local
```

Then open the URL Wrangler prints (typically http://localhost:8788).

**Gotchas:**
- `npm run build` doesn't reload `_config.yml` — restart it after editing
  site title, plugins, etc.
- If `wrangler pages dev` starts returning `D1_ERROR: no such table` after
  working fine, check for more than one `wrangler pages dev` process bound
  to the same port (`netstat -ano | grep 8788` on Windows) — each resolves
  its local D1 file slightly differently. Kill the extras and restart.

### Testing

Two layers, `npm test` runs both:

- **Unit** (`tests/unit/`, Node's test runner) — validation/rate-limit/
  hashing logic in `functions/_lib/comments.js`. `npm run test:unit`.
- **E2E** (`tests/e2e/`, Playwright + Chromium) — everything that only
  breaks with a real browser's Range/CSS engine: nested `<mark>`s from
  overlapping comments, selections crossing block boundaries, popover
  dismissal, duplicate `<title>` tags. `tests/e2e/other-pages-comments.spec.js`
  covers homepage/`/posts/`/`/notes/` comment threads (`data-post-slug`
  scoping, select-and-post-and-reload). `npm run test:e2e` builds the
  site, wipes/re-migrates a dedicated local D1 (`--persist-to=.wrangler-test/`,
  separate from your dev database), and serves it on port 8799
  (`playwright.config.js`'s `webServer`). Each test sets its own fake
  `CF-Connecting-IP` header so the shared rate limiter doesn't trip
  between tests (`fakeIp()` in `tests/e2e/helpers.js`).

Debugging: `npx playwright test --ui` for interactive mode, `npx
playwright show-trace <path>` to inspect a failed run's trace (saved to
`test-results/`).

### Deployment steps taken

Merges to `main` and other branches auto-deploy.

#### Prod

1. Created a D1 DB via `npx wrangler d1 create personal-site-comments`,
   pasted values into `wrangler.toml`.
2. `npm run d1:migrate:prod` to apply the schema.
3. Connected the repo as a Cloudflare Pages project (Compute → Workers and
   Pages → Create application → Pages → Continue with GitHub;
   [docs](https://developers.cloudflare.com/pages/get-started/git-integration/)):
    - Framework preset: Jekyll
    - Build command: `node scripts/check-env.js && jekyll build`
    - Build output directory: `_site`
    - Env vars: Secret `IP_HASH_SALT` = whatever; Text `RUBY_VERSION` =
      `3.2.10` (match local)
4. Enabled automatic deployments only for `main`.

#### Dev

1. Created dev DB via `npx wrangler d1 create personal-site-comments-dev`,
   pasted values into `wrangler.toml` under `[[env.preview.d1_databases]]`.
2. `npm run d1:migrate:dev` to apply the schema.
