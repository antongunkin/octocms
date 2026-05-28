# OctoCMS

A file-based CMS for Next.js. Schema defined in TypeScript, content stored as JSON files, Git-backed, no database.

**[octocms.gunkin.dev](https://octocms.gunkin.dev)** · [Docs](https://octocms.gunkin.dev/docs)

## Requirements

- Next.js 15+
- React 18+
- Node.js 18+
- A GitHub App (for CMS authentication)

## Install

```bash
npm install octocms
```

## Initialize

Run in the root of an existing Next.js project:

```bash
npx octocms init
```

This creates:
- `cms/octocms.config.ts` — your schema
- `app/cms/` — CMS admin route (protected by GitHub OAuth)
- `app/hello/page.tsx` — demo page using `query()`
- `cms/content/helloPage/` — demo content entry
- `.env.local` — environment variable stubs
- `README.md` — setup guide

Then fill in `.env.local` and run:

```bash
npx octocms types:gen   # generate TypeScript types
npm run dev
```

Visit `http://localhost:3000/cms` to open the editor.

## Environment Variables

```bash
GITHUB_ID=              # GitHub App client ID
GITHUB_SECRET=          # GitHub App client secret
CMS_SESSION_SECRET=     # Random string: openssl rand -base64 32
CMS_APP_URL=http://localhost:3000

# Required in production
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=
# CMS_GITHUB_TOKEN=     # Optional: for private repos / higher rate limits
```

## CLI

```bash
npx octocms init         # Initialize in a Next.js project
npx octocms types:gen    # Regenerate TypeScript types from schema
npx octocms dev          # Start dev server with config watching
npx octocms validate     # Validate all content against schema
npx octocms update       # Regenerate admin route files
```

## Query API

Read content in Server Components, layouts, and route handlers:

```typescript
import { query } from 'cms/__generated__/query';

// List
const posts = await query('post')
  .filter((p) => p.fields.publishedAt !== null)
  .sort('publishedAt', 'desc')
  .limit(10)
  .toArray();

// Singleton
const page = await query('homePage').first();
```

## License

MIT
