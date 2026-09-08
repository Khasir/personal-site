# personal-site

Source code (+ related stuff) for Khasir's personal website. The following README is handwritten, based on an earlier AI-generated version.

---

## Overview

- [Jekyll](https://jekyllrb.com/) static site
- Deployed on [Cloudflare Pages](https://developers.cloudflare.com/pages/)
- Comments use:
  - [Cloudflare Pages Functions](https://developers.cloudflare.com/pages/functions/)
  - [D1 SQLite database](https://developers.cloudflare.com/d1/)
- Comment notifier uses:
  - [Cloudflare Worker](https://developers.cloudflare.com/workers/) set to run hourly
  - [Resend](https://resend.com/) free tier


## Local development

How to run locally:

```sh
# First time only
git submodule update --init     # pulls in ./content
bundle install
npm install
cp .dev.vars.example .dev.vars  # fill in values as needed
npm run d1:migrate:local        # also need to run whenever a new migration is made

# Build site
npm run build

# Serve site and comment functions
npm run site:local

# Run comment notifier service
npm run notifier:local
# Can then visit to trigger manually: http://localhost:<port>/__scheduled

```

## Local testing

How to test locally:

```sh
npm test
```

## Deployment

Automatically deployed on merge and push to `main`:
- Website changes
- Comment functionality

Not automatically deployed:
- Comment database migrations
- Comment notifier

The last two need to be deployed via the following:

```sh
# For dev:
npm run d1:migrate:dev
npm run notifier:deploy:dev

# For main:
npm run d1:migrate:prod
npm run notifier:deploy:prod
```

### Initial deployment

#### Prod

1. Created a D1 DB via `npx wrangler d1 create personal-site-comments`, then paste the returned values into `wrangler.toml`.
2. Ran `npm run d1:migrate:prod` to apply the schema to the prod database.
3. In the Cloudflare web UI, created an app that connects the repo in the Cloudflare dashboard as a Pages project ([add'l info here](https://developers.cloudflare.com/pages/get-started/git-integration/)):
    - Compute -> Workers and Pages -> Create application -> Get started with Pages -> Continue with GitHub
    - Selected framework preset: Jekyll
    - Set build command: `node scripts/check-env.js && jekyll build`
    - Set build output directory: `_site`
    - Added environment vars:
        - Secret: `IP_HASH_SALT` = whatever
        - Text: `RUBY_VERSION` = `3.2.10` to match local dev
4. Enabled automatic deployments only for `main`.

#### Dev

1. Created dev DB via `npx wrangler d1 create personal-site-comments-dev`, then pasted values into `wrangler.toml` under `[[env.preview.d1_databases]]`.
2. Ran `npm run d1:migrate:dev` to apply the schema to the dev DB.
