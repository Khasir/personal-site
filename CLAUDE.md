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
interviews / guestbook`, diamond-separated; footer adds `rss` / `colophon`, header adds
the accessibility menu (below). A `rough notes` link exists behind a `show_notes` param nothing currently passes
`true` (see commit `c0ca090`) — `/notes/` still works, just isn't linked. No
copyright line, by design.

## Site architecture

Jekyll static site on Cloudflare Pages. Comments and the guestbook are
backed by a Cloudflare Pages Function + D1 (SQLite), since Jekyll can't
accept submissions at request time.

### Content model

Posts, notes, interviews, and images live in a separate
[personal-site-content](https://github.com/Khasir/personal-site-content)
repo, mounted as a git submodule at `./content` (`collections_dir: content`
in `_config.yml`). Clone with `--recurse-submodules`, or `git submodule
update --init` after a normal clone; `git submodule update` after pulling to
pick up content changes.

- `content/_posts/*.md` — posts, permalink `/posts/:title/`
- `content/_notes/*.md` — rougher notes, permalink `/notes/:title/`
- `content/_interviews/*.md` — interviews, permalink `/interviews/:title/`
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
`_notes` and `_interviews` have no fallback — set it explicitly). `hidden: true` excludes a
post/note/interview from `/posts/`, `/notes/`, `/interviews/`, the interviews
feed, and the homepage's recent list, but it's still reachable by direct link. `tags` drives an auto-generated
`/tags/:tag-slug/` page per tag (`_plugins/tag_pages.rb`, template
`_layouts/tag.html` loaded via `read_yaml`), newest-first across all
three collections; each tag in `entry.html`'s meta line links there.

Within a post/note body:

- **Images**: `{% include figure.html src="..." alt="..." caption="..." align="left|right|center" width="320px" %}` —
  click for full-screen. `caption` is inline-markdown (footnotes merge into
  the post's numbering); the lightbox caption strips footnote markers
  (`_plugins/strip_footnotes.rb`); `alt` stays plain text.
- **Galleries**: wrap `figure.html` includes in
  `{% gallery caption="..." columns=3 %}` … `{% endgallery %}`
  (`_plugins/gallery.rb`, a Liquid block tag). Square `object-fit: cover`
  tiles, `columns` 1–6 (default 3, at most 2 under 600px — passed as
  `--gallery-cols`/`--gallery-cols-narrow` since `min()` in `repeat()`
  isn't reliable); figures' `align`/`width` are ignored inside. Per-image
  captions are hidden in the grid and shown only in the lightbox (so keep
  footnotes out of them); the optional gallery `caption` shows under the
  grid, inline-markdown with footnotes like `figure.html`. The lightbox
  (`assets/js/lightbox.js`) groups by the clicked link's `.gallery`:
  prev/next buttons, ←/→ keys, horizontal swipe, "n / total" counter,
  wraps around, preloads neighbours. Standalone figures stay single-image.
  The gallery's output is plain HTML without `markdown="1"`, so only
  include tags belong inside. Not available in encrypted posts (Liquid is
  refused there).
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
- **Internal link previews**: hovering/focusing a link to another post or
  note shows a tooltip with its title, subtitle and first paragraph
  (`assets/js/page-previews.js`, reusing `.hover-tooltip`). The target is
  `fetch`ed on first hover, parsed with `DOMParser`, and cached by pathname —
  nothing is generated at build time. Only links inside `.entry-content`
  are wired, and only to same-host, extensionless-or-`.html` paths other than
  the current page (so no images/lightbox, footnotes, `feed.xml`). Pages
  without `.entry-heading` (list/tag pages) yield no tooltip. The excerpt is
  the first direct-child `<p>` (footnote `<sup>`s dropped), rendered as a
  single `nowrap` line with a `mask-image` fade, so under one line shows
  (`.page-preview-excerpt`). An encrypted target's subtitle is skipped if
  it's still `hidden`, so the preview doesn't reveal it; its body is empty,
  so no excerpt either. It gets the lock icon before its title: `entry.html` emits `<template data-lock-icon>` (built from `lock-icon.html`) on encrypted entries, and the preview clones it from the fetched page. Skipped for pointer listeners on `(hover: none)`
  (focus still works). The title is lowercased via CSS, with an override in
  `accessible.css`.
- **Quote attribution**: `> Quote.\n>\n> — Someone\n> {: .attribution}`
- **Quote width**: blockquotes are centred by default (`margin: 1.5rem
  auto`), which only shows once one is narrowed: put
  `{: style="max-width: 30em"}` on the line *above* the quote (below it
  risks being read as part of the last paragraph). Use `max-width` in `em`
  so it still shrinks on phones and scales with the larger-size option.
- **Expansion sections**: native `<details>`/`<summary>`, needs
  `markdown="1"` for markdown inside.

### Interviews section

A third collection alongside posts and notes (`interviews` in `_config.yml`,
`layout: entry`, comments on by default, same frontmatter as above — set
`post_date`). Renders through the same `entry` layout, so footnotes,
figures/galleries, encryption, comments, reactions and link previews all work.

- **List page**: `/interviews/` (`interviews.md` → `_layouts/interviews-list.html`,
  a copy of `notes-list.html`). Linked from the header and footer nav
  (`_includes/nav.html`, between `posts` and `guestbook`). **Not** on the
  homepage — `home.html` only lists posts. Comments are off on the list page
  (unlike `/notes/`); the intro copy is whatever's in `interviews.md`'s body.
- **Own feed**: `/interviews/feed.xml` (`interviews-feed.xml`, hand-written
  Atom, same shape as `feed.xml`). Dated from `post_date` (the posts feed
  uses `date`, which for a collection without filename dates would just be
  build time); skips `hidden`; excerpt-only by default (same three
  checks as `feed.xml`: the entry's `feed.excerpt_only`, then `encrypted`,
  then `site.feed.excerpt_only`; the first is set to `true` for every
  interview by the `interviews` entry in `_config.yml`'s `defaults`, and
  `feed: { excerpt_only: false }` in an interview's frontmatter sends its full
  content instead), so only the summary (`link_preview`, else the first
  paragraph) is sent; `site.feed.posts_limit`
  (default 10) most recent, shared with `feed.xml`. Linked only from the
  interviews page (`rss feed for interviews`, `.see-all`) and an
  autodiscovery `<link rel="alternate">` in `<head>` on that page and on
  interview entries (`_includes/head.html`) — deliberately **not** in the
  footer, whose `rss` stays the posts feed. Interviews aren't in `/feed.xml`.
- **Labels**: the `post`/`note`/`interview` kind label comes from
  `_includes/entry-kind.html` (used by `entry.html` and `tag.html`); add a
  case there for any further collection. `_plugins/seo_description.rb` and
  `_plugins/tag_pages.rb` also list the collection.
- **Comment threads** key on `page.slug`, so an interview and a post/note with
  the same slug would share a thread (already true of posts vs notes).

### Accessibility menu

The "accessibility" button — header (icon only) and footer ("accessibility"
label only), via `_includes/nav.html`'s `show_a11y` param (`"icon"` from
`header.html`, `"label"` from `footer.html`) — opens a small menu with two
independent toggle buttons, **More readable font** and **Larger font size**
(`[data-a11y-option="font|size"]`, `aria-pressed`). The trigger
(`[data-a11y-toggle]`) is a disclosure button (`aria-haspopup`,
`aria-expanded`, `aria-controls`), not a toggle. Each include renders its own
menu (`#a11y-menu-header` / `#a11y-menu-footer`); the two are kept in sync and
only one is open at a time. Clicking an option keeps the menu open; outside
click or Escape closes it (Escape returns focus to the trigger). Disclosure
pattern rather than `role="menu"`, so no arrow-key handling is needed.
`assets/css/accessible.css` is loaded after `main.css` on every page and is
inert without the attributes below (except the menu's own look) — an overlay,
not a replacement, so `main.css` isn't duplicated.

Each option is an attribute on `<html>`:

- **Font** — `data-a11y-font="on"` (storage key `a11y-font`): redefines the
  `:root` custom properties (same cream bg, all-black text incl.
  muted/meta/form-status, darker link accent, darker borders, self-hosted
  Aleo in `--font-serif`), line-height 1.75, plus the rest of the
  "readable" bundle: `text-transform: none` for the lowercase rules
  (titles/dates show as authored, and the `<title>`), always-underlined
  links (`!important`, since `main.css` drops underlines on some
  `:hover`s), 3px `:focus-visible` outline, underlined comment highlights,
  always-visible reaction `+☺` in the row, no `details` transition. New
  lowercase/hover-only/colour-only cues need a matching override there.
- **Size** — `data-a11y-size="on"` (storage key `a11y-size`): only
  `html { font-size: 112.5% }`. `main.css` sizes everything in rem (body
  included, `1.1875rem` = 19px at the default root) so the type scale
  follows. New font-sizes in `main.css` must stay in rem/em or they won't
  scale.
- **The menu itself always looks accessible** (`.a11y-menu` in
  `accessible.css`, *not* scoped to an option): Aleo, 18px, black text,
  darker accent/border, underlined buttons, 3px focus ring — it redefines
  the variables locally. Items are separated by a line (no box per item); pressed =
  fill + bold + a bar down the left edge, not colour alone. Its size is `1.125rem`, dropped to `1rem` when the size option is
  on (the root is already scaled). Positioned in `main.css` against the
  header/footer `.wrap` (`position: relative`; `width: min(17em, 100%)`, so
  it can't overflow a phone): header opens downward, right-aligned; footer
  opens upward, centred (so it never lengthens the page). `z-index: 400`
  like the comment popovers.
- **Font**: Aleo (slab serif), self-hosted like EB Garamond — variable
  woff2, `assets/fonts/aleo-normal.woff2` / `aleo-italic.woff2`, declared in
  `accessible.css` (not `main.css`) so it's only fetched when the font
  option is on or the menu is first opened (`display: none` doesn't
  fetch); no preload. Licensed under the SIL OFL, which allows this without
  changing the site's `LICENSE`; keep `assets/fonts/aleo-OFL.txt` alongside
  the files. (Atkinson Hyperlegible and the system sans stack were tried and
  rejected.)
- **State**: per option, `localStorage["a11y-font"|"a11y-size"]` =
  `"on"`/`"off"` (explicit choice). Resolution order per option: its own key
  → the legacy single-switch `a11y-mode` (so returning visitors who had the
  old mode keep it: `"on"` = both options) → `prefers-contrast: more`
  (both on), live. The first click on an option migrates: writes both new
  keys from the legacy value, removes `a11y-mode`, then applies the click —
  after that the legacy fallback is inert. A blocking inline script in
  `_includes/head.html` sets the attributes before first paint (no flash);
  `assets/js/accessibility.js` handles the menu, option clicks,
  `aria-pressed`, migration, and the OS-change listener (never migrates).
  Both wrap storage in try/catch. Keep their initial-state logic in sync.
- **`<title>`**: `_layouts/entry.html` stashes the authored title in
  `<html data-original-title>` and lowercases it unless the **font**
  option is on; `accessibility.js` re-applies the right casing on toggle.
- **Icon**: inline SVG ("Accessibility" by Zach Bogart, Noun Project;
  credited on the colophon), `currentColor`, so it follows the link colour.
  Neither option on = outline ring + figure; **either** on = filled disc
  with the figure knocked out (and bold label), driven by CSS from the
  `<html>` attributes (no JS, no flash). Only the header button has it;
  there the label is visually hidden (`.a11y-toggle--icon-only`; still the
  accessible name, plus a `title` tooltip) to keep the header short. The
  footer button is the word alone, no icon.
- **Header fit**: `.site-nav` also wraps (`flex-wrap`) so the extra item
  can't overflow narrow screens.

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
  build. Both scripts also accept `--password=<passphrase>` as a fallback
  used only when the env var is unset/blank (env var wins); note it lands
  in shell history. `npm run decrypt-post -- <encrypted.md> <dest.md>` reverses this for
  editing; re-run `encrypt-post` afterward (fresh salt/iv each time).
- Script writes `encrypted: true` +
  `encrypted_salt`/`encrypted_iv`/`encrypted_data` (base64) to frontmatter,
  keeps public fields (`title`, `tags`, `link_preview`) as-is, leaves body
  empty. `_layouts/entry.html` renders *only* the password form for
  `page.encrypted` (no `{{ content }}`).
- **Full markdown, pre-rendered at encrypt time**: Jekyll only ever sees
  the ciphertext, so `encrypt-post` renders the body itself, via
  `scripts/render-markdown.rb` (Jekyll's own markdown converter with
  `_config.yml` loaded, so output matches normal posts — GFM, smart quotes,
  footnotes, `{: .attribution}`, rouge), called from Node through
  `scripts/lib/render-markdown.js` (`bundle exec`, needs the local Ruby
  setup; ~6s since it loads Jekyll). The encrypted plaintext is JSON
  `{ v: 2, markdown, html }` (`scripts/lib/encrypted-post-payload.js`): the
  browser inserts `html`; `decrypt-post` writes back `markdown`, so the
  source round-trips exactly. A non-JSON plaintext is read as a v1 body
  (raw markdown, from the old hand-rolled renderer), so decrypt +
  re-encrypt migrates it; the browser only accepts v2.
- **Liquid is refused**: `{% ... %}`/`{{ ... }}` (e.g. `figure.html`) would
  never be processed, so `encrypt-post` exits listing the offending lines
  (`findLiquid()`); write `&#123;` for a literal brace. So no figures/
  lightbox; images in `content/images/` would be public anyway.
- HTML comments pass through kramdown as real comments — not displayed,
  but still in the ciphertext (and the DOM), so anyone with the passphrase
  can read them. Raw HTML is inserted unsanitised, same as normal posts:
  only someone with the passphrase *and* commit access could inject any,
  and `innerHTML` doesn't run `<script>`.
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
- **Subtitle hidden until unlock — visually only**: `.entry-subtitle` gets
  `hidden` + `data-encrypted-subtitle` for `page.encrypted`, and
  `encrypted-post.js` un-hides it on successful decrypt. It stays plaintext
  in the frontmatter (public `content` repo) and page source, by choice;
  moving it into the encrypted payload was considered and declined.
- **Decrypted content must opt back into load-time-only behavior**:
  `external-links.js` exposes `window.wireExternalLinks(root)`,
  `footnotes.js` exposes `window.wireFootnotes(root)`,
  `page-previews.js` exposes `window.wirePagePreviews(root)`, and `comments.js`
  exposes `window.refreshCommentHighlights()`, all called by
  `encrypted-post.js` after revealing content (otherwise links and
  footnote hover previews aren't wired and existing comments never anchor,
  since `.entry-content` was empty at initial render). The `wire*`
  functions skip already-wired elements (a `data-*-wired` flag).
- `feed.xml` forces `excerpt_only` for `post.encrypted` (empty `<content>`,
  only `<summary>` from `link_preview`). List views (homepage recent posts,
  `/posts/`, `/notes/`, tag pages) hide `link_preview` for encrypted
  entries and show a lock (`_includes/lock-icon.html`, inline SVG,
  `currentColor`, `role="img"` + `aria-label="password-protected"`) before
  the title link, outside the `<a>` so it isn't lowercased or underlined.
  `link_preview` still feeds `og:description` and the feed summary.
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

### Emoji reactions

Comments (not guestbook entries) can be reacted to with a fixed set: 👍 💖
😆 😢 👀 🎉 🎨 (`REACTION_EMOJIS` in `functions/_lib/reactions.js`, duplicated as
`REACTIONS` in `assets/js/comments.js` — keep in sync, emoji must match
exactly). Shown in the thread popover, under each comment; encrypted posts
get them too.

- **Plain counter, no dedupe**: `comment_reactions (comment_id, emoji, count)`
  (`migrations/0004_comment_reactions.sql`, FK on `comments` with `ON DELETE
  CASCADE`, `count >= 0`). Each browser remembers what *it* added in
  `localStorage["comment-reactions"]` (`{ commentId: [emoji, ...] }`, try/catch
  wrapped; in-memory only if storage is blocked), which is what makes a pill
  show as pressed and lets a second click take it back. Deliberately
  best-effort, chosen over per-IP rows: `curl` can inflate or decrement
  counts, and there's no reaction rate limit. `remove` clamps at 0.
- **API**: `POST /api/reactions` `{ comment_id, emoji, action: "add"|"remove" }`
  → `{ comment_id, emoji, count }`; 400 for bad input, 404 for an unknown
  comment or a guestbook entry. `GET /api/comments` includes
  `reactions: { "👍": 3, ... }` per comment (fixed emoji order, zeros omitted).
  The notifier digest ignores reactions.
- **UI** (`renderReactions()` in `comments.js`): a pill per emoji with a
  count, plus a `+☺` button that opens an inline picker. `+☺` is absolutely positioned at
  the bottom-right of the comment body (`bottom: 100%` against the
  `position: relative` `.comment-reactions`, whose top edge is the body's
  bottom, so it stays put when pills or the picker appear; a comment with no
  reactions has no blank row), `opacity: 0` until the `<li>` is hovered or has focus (still
  tabbable, nothing shifts), always visible on `(hover: none)` and with the
  readable-font option (both of which move it into the row; see below). Opening the picker adds a full-width row below the
  comment (and its pills), growing the `<li>`. Updates are optimistic, replaced
  by the server's count, and rolled back on failure; in-flight toggles for the
  same comment+emoji are ignored. Counts ≥ 100 display as `99+` (display
  only; `aria-label` keeps the real number). Clicks on reaction controls
  `stopPropagation()` because re-rendering detaches the target, which the
  document-level handler would otherwise read as an outside click and close
  the thread. Escape closes the picker only.
- Touch devices (`(hover: none)`) and the readable-font option: `+☺` is
  `position: static` in the reactions row, before any pills (it's first in DOM
  order, so tab order matches), because the always-visible floating version
  would constantly cover comment text; this reserves a row under every
  comment. (Keyed on `hover`, not viewport width: a narrow desktop window
  still has hover.) Pressed state adds a heavier
  border + bold (not colour alone).

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
  hashing in `functions/_lib/comments.js`, request validation/grouping in
  `functions/_lib/reactions.js`, plus the encrypt/decrypt
  round-trip in `scripts/lib/encrypted-post-crypto.js` (via Node's
  `crypto.webcrypto`) and the payload format/Liquid detection in
  `scripts/lib/encrypted-post-payload.js`. `npm run test:unit`.
- **E2E** (`tests/e2e/`, Playwright + Chromium) — things that only break
  with a real browser's Range/CSS engine: nested `<mark>`s from overlapping
  comments, selections crossing block boundaries, popover dismissal.
  `other-pages-comments.spec.js` covers homepage/`/posts/`/`/notes/`
  threads; `reactions.spec.js` covers the reaction picker/pills (hover and
  keyboard reveal, add/remove, persistence, others' counts, blocked
  `localStorage`, rollback on failure, `99+` via a mocked
  `/api/comments` response) and the `/api/reactions` endpoint (counter
  clamp, validation, 404 for guestbook entries); `encrypted-post.spec.js` covers the unlock flow (no plaintext in
  served HTML, wrong/correct password, subtitle hidden until unlock, kramdown output — headings, smart
  quotes, code, attribution, nested lists, footnotes — hidden HTML
  comments, external links, footnote hover previews) plus
  a regression case for `window.refreshCommentHighlights()`, against a
  throwaway fixture post (`tests/e2e/fixtures/setup-encrypted-fixture.js`
  renders it through the real kramdown pipeline and writes it into
  `content/_posts/` before build; `global-teardown.js`
  deletes it — never committed, since `content` is public). `npm run
  test:e2e` builds the site, wipes/re-migrates a dedicated local D1
  (`.wrangler-test/`), and serves on port 8799. Each test sets its own fake
  `CF-Connecting-IP` (`fakeIp()` in `helpers.js`) so the shared rate limiter
  doesn't trip between tests. `design.spec.js` also covers internal link
  previews (links injected into the homepage intro, since posts' links
  aren't known; title/excerpt shown, nowrap excerpt, no preview for
  list pages/images/feed). `accessibility.spec.js` covers the
  accessibility menu: open/close (outside click, Escape + focus return, one
  menu at a time), the two options independently (font vs size computed
  styles), persistence, legacy `a11y-mode` fallback + migrate-on-click,
  `prefers-contrast: more` emulation + per-option override, no flash
  (attributes set before `<body>` exists), broken `localStorage`, the
  menu's always-accessible look, `<title>` casing (font option only), and
  no horizontal overflow / menus kept on screen at 375px. `gallery.spec.js` covers `{% gallery %}`
  (square tiles, ignored `align`, hidden per-image captions, gallery
  caption + footnote, lightbox prev/next/keys/wrap, standalone figures
  unaffected, 2 columns at 375px) against another throwaway fixture post
  (`tests/e2e/fixtures/setup-gallery-fixture.js`, inline SVG data URIs so
  it needs nothing in `content/images/`), also removed by
  `global-teardown.js`. `interviews.spec.js` covers the interviews
  section (nav links in header + footer, feed not in the footer, list page
  shows non-hidden entries + feed link + `<head>` autodiscovery, not on the
  homepage/`/posts/`, entry page with `interview` label, hidden entry still
  reachable, tag page, `/interviews/feed.xml` summary-only entries and its absence from
  `/feed.xml`) against two throwaway fixtures
  (`tests/e2e/fixtures/setup-interview-fixture.js`, written to
  `content/_interviews/` — one visible, one `hidden`), removed by
  `global-teardown.js` (which also removes the directory if empty).

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
