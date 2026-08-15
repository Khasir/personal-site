# personal-site
Source code (+related stuff) for Khasir's personal website.

Jekyll static site, deployed on Cloudflare Pages. Public comments and the
guestbook are backed by a Cloudflare Pages Function + D1 (SQLite) database,
since Jekyll itself can't accept submissions at request time.

## Content model

- `_posts/*.md` — blog posts, permalink `/posts/:title/`
- `_notes/*.md` — rougher notes, permalink `/notes/:title/`

Both collections share the same frontmatter shape:

```yaml
---
title: "Post title"
subtitle: "One-line subtitle, also shown in list views (optional)."
post_date: 2026-08-09
modified_date: 2026-08-12   # optional, shown as "updated ..." if present
tags: [optional, list]
---
```

`post_date` is what's displayed and sorted on. For `_posts` it falls back to
the date in the filename (`YYYY-MM-DD-title.md`) if omitted; `_notes` has no
such fallback, so set it explicitly there.

Add `hidden: true` to exclude a post/note from `/posts/`, `/notes/`, and the
homepage's "recent" lists — the page still builds normally and is reachable
by anyone with the direct link.

Within a post/note body:

- **Images**: `{% include figure.html src="/assets/images/foo.jpg" alt="..." caption="..." align="left|right|center" width="320px" %}`
  — click any image to view it full-screen.
- **Footnotes**: standard kramdown syntax, e.g. `text[^1]` with `[^1]: the note`
  at the end of the file. Hover/focus the marker to preview it inline; click
  jumps to the note at the bottom of the post.
- **Comments**: automatic on any post/note (set `comments: false` in
  frontmatter to disable). Visitors select text in the body to attach a
  comment to that passage — no account required.
- **Dates**: rendered lowercase everywhere (CSS `text-transform`, so the
  underlying text/`datetime` attribute are untouched). On post/note pages the
  meta line reads `p. <date>` / `l.m. <date>` (posted / last modified), each
  wrapped in `<abbr title="...">` so the full word shows on hover.
- **External links** automatically open in a new tab and get a small arrow
  (`assets/js/external-links.js`, based on the link's hostname — no markup
  needed).
- **Quote attribution**: mark a blockquote's attribution line explicitly so
  it right-aligns:
  ```
  > Quote text.
  >
  > — Someone
  > {: .attribution}
  ```
- **Expansion sections**: native `<details>`/`<summary>`, styled to match the
  site. Markdown inside requires `markdown="1"` on the `<details>` tag:
  ```html
  <details markdown="1">
  <summary>Click to expand</summary>

  Body text, **markdown** works here.

  </details>
  ```

## Design

Minimal, elegant, bookish, nostalgic — EB Garamond throughout, warm
cream/tan palette. Self-hosted (`assets/fonts/`, two variable-font files:
regular + italic, each covering weights 400–700) rather than pulled from
Google Fonts, mainly to avoid sending every visitor's IP to Google on each
page load.

Palette (see `:root` in `assets/css/main.css` for the full list):
- Background `#eadbcb`, text `#000000`, links `#1155cc`
- Blockquotes: background `#fff2cc`, left border `#b0aea9`, text `#1b1b1a`

Header and footer both show the same nav (`home / posts / rough notes /
guestbook`, diamond-separated, sharing `_includes/nav.html`); the footer
additionally gets an `rss` link the header doesn't have. There's no
copyright line by design.

## Comments & guestbook architecture

Both are backed by the same `comments` D1 table (see `functions/`), split by
a `kind` column. Deliberate choices worth knowing before changing this:

- **Appears instantly, no moderation queue.** The user chose speed over
  safety here — a submission is live as soon as it's POSTed. The only
  guards are a honeypot field and a per-IP rate limit (5 posts/60s, salted
  hash, see `functions/_lib/comments.js`). No Turnstile/CAPTCHA yet, but the
  submit path is structured so one can be dropped in later. No notification
  (email/Discord/etc.) is wired up either — both were explicitly deferred.
- **Overlapping highlights.** When two comments' anchored text ranges
  overlap, the article is re-partitioned into non-overlapping `<mark>`
  segments, each tagged with every comment covering it (see `renderAll()` in
  `assets/js/comments.js`) — wrapping each comment's range independently
  corrupted the markup. Hovering any one segment of a comment's range
  highlights that comment's *entire* range as one block, using whichever
  comment is most-recently-posted as "primary" wherever ranges overlap.
  Clicking a highlight's thread popover has an "add a comment" action that
  replies using that same primary comment's anchor, without the visitor
  re-selecting text.
- **Text anchoring** uses a quote + prefix/suffix context match (like a
  simplified Hypothes.is), falling back to a bare quote search if the
  surrounding text has since changed. If neither matches, the comment is
  dropped from the inline view (still in the DB, just not rendered).

## Crawling / scraping stance

`robots.txt` (blanket `Disallow: /`) and `llms.txt` (plain-language opt-out
of AI training/scraping use) are both intentional — this site is meant to
be shared link-to-link with people the author knows, not indexed or
crawled. `jekyll-sitemap` was deliberately removed for the same reason
(publishing a full sitemap.xml undercuts asking crawlers to stay out).
Keep this in mind before adding anything SEO/discoverability-oriented.

Both files are honor-system only; they don't stop a scraper that ignores
them. Cloudflare's dashboard-level bot-blocking (incl. a one-click "block AI
bots" toggle, free tier) would add real enforcement but hasn't been turned
on yet — it's an account setting, not a repo change.

## Current status

- **Connected to Cloudflare Pages.** The repo is linked as a Pages project
  and auto-deploys on push to `main` and `dev`. Cloudflare Pages' usual
  behavior is that one branch (typically `main`) is the "production"
  branch deploying to the project's main URL, while every other connected
  branch (`dev` here) gets its own preview deployment at a separate URL —
  worth double-checking that's set up the way you want in the Pages
  project's dashboard settings.
- **No custom domain picked yet** — runs on the free `*.pages.dev`
  subdomain until one is chosen.
- **`IP_HASH_SALT` build check wired up for `main`.** The Pages dashboard
  build command now runs `node scripts/check-env.js && jekyll build`
  (Settings → Builds & deployments), so a deploy fails instead of silently
  falling back to the insecure default salt at runtime. Confirmed set for
  `main`; Cloudflare Pages build commands are historically project-wide
  rather than per-branch, but worth double-checking `dev`/preview deploys
  pick it up too.

## Local development

Requires Ruby/Bundler (for Jekyll) and Node (for Wrangler/Cloudflare
Pages Functions). Two processes, run in separate terminals:

```bash
bundle install
npm install
```

```bash
# Terminal 1 — rebuilds _site/ on change
npm run jekyll:watch
```

```bash
# Terminal 2 — serves _site/ and the /api/* functions together, with a
# local D1 database
cp .dev.vars.example .dev.vars   # first time only
npm run d1:migrate:local          # first time only, and after schema changes
npm run dev
```

Then open the URL Wrangler prints (typically http://localhost:8788).

**Gotchas hit while developing this:**
- `jekyll:watch` rebuilds on content/template changes, but does **not**
  reload `_config.yml` — restart it after editing site title, plugins, etc.
- If `wrangler pages dev` starts returning `D1_ERROR: no such table` after
  working fine, check for more than one `wrangler pages dev` process bound
  to the same port (`netstat -ano | grep 8788` on Windows) — each resolves
  its local D1 file slightly differently, and stray leftover processes from
  earlier runs cause exactly this symptom. Kill the extras and restart.

## Testing

Two layers, `npm test` runs both:

- **Unit tests** (`tests/unit/`, Node's built-in test runner) — the pure
  validation/rate-limit/hashing logic in `functions/_lib/comments.js`.
  `npm run test:unit`.
- **E2E tests** (`tests/e2e/`, Playwright + real Chromium) — everything that
  only breaks with an actual browser's Range/CSS engine, which is most of
  what's gone wrong in this project so far: nested `<mark>`s from
  overlapping comments, selections crossing block boundaries, the popover
  dismissing itself, duplicate `<title>` tags. `npm run test:e2e` builds the
  site, wipes and re-migrates a dedicated local D1 (`--persist-to=.wrangler-test/`,
  entirely separate from your own dev database), and serves it on port 8799
  before running — see `playwright.config.js`'s `webServer`. Each test sets
  its own fake `CF-Connecting-IP` header so the shared rate limiter doesn't
  trip between unrelated tests (see `fakeIp()` in `tests/e2e/helpers.js`).

Run `npx playwright test --ui` for the interactive UI mode when debugging a
failure, or `npx playwright show-trace <path>` to inspect a failed run's
trace (saved automatically to `test-results/`).

## Deployment steps taken

1. Create a D1 DB via `npx wrangler d1 create personal-site-comments`, then paste the returned values into `wrangler.toml`.
2. `npm run d1:migrate:remote` to apply the schema to the real database.
3. In the Cloudflare web UI, create an app that connects the repo in the Cloudflare dashboard as a Pages project ([add'l info here](https://developers.cloudflare.com/pages/get-started/git-integration/)):
    - Compute -> Workers and Pages -> Create application -> Get started with Pages -> Continue with GitHub
    - Select framework preset: Jekyll
    - Set build command: `node scripts/check-env.js && jekyll build`
    - Set build output directory: `_site`
    - Add environment vars:
        - Secret: `IP_HASH_SALT` = whatever
        - Text: `RUBY_VERSION` = `3.2.10` to match local dev

Merges to main and other branches are automatically deployed.
