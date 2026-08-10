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
date: 2026-08-09
tags: [optional, list]
summary: "One-line summary shown in list views (optional)."
---
```

Within a post/note body:

- **Images**: `{% include figure.html src="/assets/images/foo.jpg" alt="..." caption="..." align="left|right|center" width="320px" %}`
  — click any image to view it full-screen.
- **Footnotes**: standard kramdown syntax, e.g. `text[^1]` with `[^1]: the note`
  at the end of the file. Hover/focus the marker to preview it inline; click
  jumps to the note at the bottom of the post.
- **Comments**: automatic on any post/note (set `comments: false` in
  frontmatter to disable). Visitors select text in the body to attach a
  comment to that passage — no account required.

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

## Deploying

1. `npx wrangler d1 create personal-site-comments`, then paste the returned
   `database_id` into `wrangler.toml`.
2. `npm run d1:migrate:remote` to apply the schema to the real database.
3. Connect the repo in the Cloudflare dashboard as a Pages project (build
   command `bundle exec jekyll build`, output directory `_site`), or deploy
   directly with `npx wrangler pages deploy _site`.
4. Set the `IP_HASH_SALT` secret on the Pages project: `npx wrangler pages secret put IP_HASH_SALT`.
5. Bind the `personal-site-comments` D1 database to the Pages project as `DB`
   (Cloudflare dashboard → Pages project → Settings → Functions → D1 bindings).
