/**
 * File templates used by `octocms init` and `octocms update`.
 */

const CODEGEN_BANNER = `/*
 * AUTO-GENERATED — DO NOT EDIT.
 * Generated from cms/octocms.config.ts.
 * Run \`npx octocms types:gen\` to regenerate.
 */

`;

/** Static cms/__generated__/types.ts for the helloPage demo schema. */
export const generatedTypesTemplate =
  CODEGEN_BANNER +
  `import type { EntryStatus } from 'octocms/types';

export interface HelloPageFields {
  title: string;
  description: string;
}

export interface HelloPageEntry {
  sys: { id: string; type: 'helloPage'; status: EntryStatus };
  fields: HelloPageFields;
}

export type AnyEntry = HelloPageEntry;

export type EntryMap = {
  helloPage: HelloPageEntry;
};
`;

/** Static cms/__generated__/enums.ts for the helloPage demo schema. */
export const generatedEnumsTemplate =
  CODEGEN_BANNER +
  `export const CollectionName = {
  HelloPage: 'helloPage',
} as const;
export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName];

export const COLLECTION_NAMES = ['helloPage'] as const;

export const FieldFormat = {
  String: 'string',
  Text: 'text',
  Markdown: 'markdown',
  Boolean: 'boolean',
  Reference: 'reference',
  Image: 'image',
  Number: 'number',
  Datetime: 'datetime',
  Json: 'json',
  Slug: 'slug',
  Select: 'select',
  Url: 'url',
  Color: 'color',
  Conditional: 'conditional',
  Richtext: 'richtext',
} as const;
export type FieldFormat = (typeof FieldFormat)[keyof typeof FieldFormat];
`;

/** Static cms/__generated__/content.d.ts for the helloPage demo schema. */
export const generatedContentDeclsTemplate =
  CODEGEN_BANNER +
  `import type { EntryStatus } from 'octocms/types';

// Raw on-disk types (before query() processing).
export interface RawHelloPageFields {
  title: string;
  description: string;
}

export interface RawHelloPageEntry {
  sys: { id: string; type: 'helloPage'; status: EntryStatus };
  fields: RawHelloPageFields;
}
`;

/** Static cms/__generated__/index.ts — always the same shape. */
export const generatedIndexTemplate =
  CODEGEN_BANNER +
  `export * from './types';
export * from './enums';
export * from './query';
`;

/** Static cms/__generated__/query.ts — always the same shape (schema-independent). */
export const generatedQueryTemplate =
  CODEGEN_BANNER +
  `import { createQuery } from 'octocms/query';
import { configOctoCMS, type OctoConfig } from '../octocms.config';
import type { EntryMap } from './types';

// configOctoCMS is widened to Config for admin internals; cast back to OctoConfig so
// createQuery preserves literal collection/field names for type-safe queries.
export const query = createQuery<EntryMap, OctoConfig>(configOctoCMS as unknown as OctoConfig);
`;

/** Static cms/__generated__/configInit.ts — always the same shape (schema-independent). */
export const generatedConfigInitTemplate =
  CODEGEN_BANNER +
  `import { configOctoCMS } from '../octocms.config';
import { setConfig } from 'octocms/lib/configStore';

setConfig(configOctoCMS);
`;

/**
 * All scaffolded files import the generated config initialiser via the bare
 * specifier `cms/__generated__/configInit`. Resolution works in two layers:
 *
 *   - TypeScript IntelliSense: the consumer's `tsconfig.json` `paths` (added
 *     by `octocms init`).
 *   - Bundler: an alias registered by `withOctoCMS()` so Webpack and Turbopack
 *     resolve the bare specifier from anywhere — including `app/layout.tsx`,
 *     route handlers at any depth, and files inside `node_modules/octocms/`.
 *
 * This eliminates the previous depth-counting (`'../../../cms/...'`) that was
 * a recurring source of off-by-one bugs across templates and routes.
 */
const CONFIG_INIT_IMPORT = "import 'cms/__generated__/configInit';";

/**
 * Minimal root layout written when `app/layout.tsx` does not already exist.
 * The configInit import is the critical side-effect; the rest is a Next.js
 * boilerplate shell.
 */
export const rootLayoutTemplate = `${CONFIG_INIT_IMPORT}
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My App',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

/** The one-liner prepended to an existing root layout to register the config. */
export const rootLayoutConfigInitImport = `${CONFIG_INIT_IMPORT}\n`;

export function buildAdminLayoutTemplate(): string {
  return `${CONFIG_INIT_IMPORT}
import 'octocms/globals.css';
import '@mdxeditor/editor/style.css';

export { AdminLayout as default, metadata } from 'octocms/admin';
`;
}

/**
 * Catch-all admin route — every \`/cms/*\` URL renders the package's
 * \`AdminApp\` async server component (awaits \`params\`, no outer Suspense).
 * Side-effect-imports \`configInit\` so server-action bundles register
 * \`setConfig()\` even when Next.js does not load \`layout.tsx\` for the POST.
 */
export function buildAdminPageTemplate(): string {
  return `// Registers setConfig() for server actions — some POST bundles skip layout.tsx.
${CONFIG_INIT_IMPORT}

export { AdminApp as default } from 'octocms/admin';
`;
}

/**
 * Admin error boundary — rendered by Next.js when anything in the catch-all
 * tree throws during render. Re-uses the shared \`AdminErrorView\` so GitHub
 * config / auth / availability / rate-limit copy stays consistent with the
 * public-page error boundary.
 */
export const adminErrorTemplate = `'use client';

export { AdminError as default } from 'octocms/admin';
`;

/**
 * Historical template values used by \`octocms update\` to recognise an
 * unmodified install when migrating between routing models. Each entry is
 * the literal file content shipped by a previous OctoCMS version. If a
 * user-app file matches one of these byte-for-byte, \`update\` will replace
 * it with the current template; otherwise it leaves it alone.
 */
export const LEGACY_ADMIN_LAYOUT_TEMPLATES: ReadonlyArray<string> = [
  // 0.4.x — re-exported from the deep path.
  `import '../../cms/__generated__/configInit';
import 'octocms/globals.css';
import '@mdxeditor/editor/style.css';

export { AdminLayout as default, metadata } from 'octocms/admin/pages/AdminLayout';
`,
  // 0.5.x — barrel re-export with depth-counted relative configInit import.
  `import '../../cms/__generated__/configInit';
import 'octocms/globals.css';
import '@mdxeditor/editor/style.css';

export { AdminLayout as default, metadata } from 'octocms/admin';
`,
];

export const LEGACY_ADMIN_CATCH_ALL_TEMPLATES: ReadonlyArray<string> = [
  // 0.4.x — re-exported from the deep path.
  `export { AdminApp as default } from 'octocms/admin/AdminApp';
`,
  // 0.5.x — barrel re-export without configInit on the page (server actions could miss setConfig).
  `export { AdminApp as default } from 'octocms/admin';
`,
  // 0.5.x with depth-counted configInit (replaced by bare-specifier alias).
  `// Registers setConfig() for server actions — some POST bundles skip layout.tsx.
import '../../../cms/__generated__/configInit';

export { AdminApp as default } from 'octocms/admin';
`,
];

export const nextAuthRouteTemplate = `import NextAuth from 'next-auth';
import { authOptions } from 'octocms/admin/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`;

/**
 * Build a thin re-export Route Handler for the chat-agent SSE endpoint.
 *
 * The actual handler lives in `octocms/agent/chatApi.ts`
 * (`chatRoute` / `chatStatusRoute`). The user-app file just:
 *   1. side-effect-imports `cms/__generated__/configInit` so
 *      `getAgentConfig()` resolves on cold start (Route Handlers don't run
 *      `app/layout.tsx`); and
 *   2. re-exports `chatRoute` as `POST` and `chatStatusRoute` as `GET`.
 *
 * The configInit import uses the bare specifier (resolved by the bundler
 * alias from `withOctoCMS()`), so the route file is depth-agnostic and can be
 * placed under `app/` or `src/app/` without code changes.
 */
export function agentChatRouteTemplate(): string {
  return `// Side-effect import: registers \`configOctoCMS\` + \`agentConfig\` into the
// runtime stores so \`getAgentConfig()\` resolves on cold start. Route Handlers
// don't run \`app/layout.tsx\`, so this import has to live here.
${CONFIG_INIT_IMPORT}

export { chatRoute as POST, chatStatusRoute as GET } from 'octocms/agent';
`;
}

/**
 * Build a thin re-export Route Handler for the `/media/[...slug]` proxy.
 *
 * The actual handler lives in `octocms/admin/mediaRoute.ts`
 * (`mediaRoute`). The user-app file just:
 *   1. side-effect-imports `cms/__generated__/configInit` so `getConfig()`
 *      resolves on cold start (Route Handlers don't run `app/layout.tsx`); and
 *   2. re-exports `mediaRoute` as `GET`.
 *
 * The configInit import uses the bare specifier (resolved by the bundler
 * alias from `withOctoCMS()`), so the route file is depth-agnostic.
 */
export function mediaRouteTemplate(): string {
  return `// Side-effect import: registers \`configOctoCMS\` into the runtime store so
// \`getConfig()\` resolves on cold start. Route Handlers don't run
// \`app/layout.tsx\`, so this import has to live here.
${CONFIG_INIT_IMPORT}

export { mediaRoute as GET } from 'octocms/admin/mediaRoute';
`;
}

/**
 * Build a thin re-export Route Handler for the public-site `/api/search`
 * endpoint consumed by the `SearchBox` component shipped at
 * `octocms/components/public`.
 *
 * The actual handler lives in `octocms/admin/searchRoute.ts`
 * (`searchRoute`). The user-app file just:
 *   1. side-effect-imports `cms/__generated__/configInit` so `getConfig()`
 *      resolves on cold start (Route Handlers don't run `app/layout.tsx`); and
 *   2. re-exports `searchRoute` as `GET`.
 *
 * The configInit import uses the bare specifier (resolved by the bundler
 * alias from `withOctoCMS()`), so the route file is depth-agnostic.
 */
export function searchRouteTemplate(): string {
  return `// Side-effect import: registers \`configOctoCMS\` into the runtime store so
// \`getConfig()\` resolves on cold start. Route Handlers don't run
// \`app/layout.tsx\`, so this import has to live here.
${CONFIG_INIT_IMPORT}

export { searchRoute as GET } from 'octocms/admin/searchRoute';
`;
}

type SchemaInitOpts = { projectName: string; baseBranch: string; pointerBranch?: string };

/**
 * The starter schema used by `octocms init`. The data lives in `cms/schema.json`
 * (source of truth — hand-editable + edited by the Content Model UI). The other
 * two scaffolded files (`cms/__generated__/schema.ts` and `cms/octocms.config.ts`)
 * mirror this same shape — keep them aligned by editing here only and letting
 * `npx octocms types:gen` regenerate the rest in the user's project.
 */
function buildStarterSchema(opts: SchemaInitOpts): Record<string, unknown> {
  const git: Record<string, string> = { baseBranch: opts.baseBranch };
  if (opts.pointerBranch) git.publishedPointerBranch = opts.pointerBranch;
  return {
    projectName: opts.projectName,
    git,
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'],
    collections: {
      helloPage: {
        label: 'Hello Page',
        fields: {
          title: { label: 'Title', format: 'string', entryTitle: true, required: true },
          description: { label: 'Description', format: 'text' },
        },
      },
    },
  };
}

/**
 * `cms/schema.json` — the source of truth. The Content Model UI (`/cms/model`)
 * reads and writes this file via `getSchema()` / `saveSchema()` server actions.
 */
export function schemaJsonTemplate(opts: SchemaInitOpts): string {
  return JSON.stringify(buildStarterSchema(opts), null, 2) + '\n';
}

/**
 * `cms/__generated__/schema.ts` — auto-generated literal-typed mirror of
 * `cms/schema.json`. Required because `query()` infers narrow collection /
 * field / format types from the literal `defineConfig()` call — a plain JSON
 * import cannot preserve those literals.
 *
 * `npx octocms types:gen` regenerates this from `cms/schema.json` after every
 * schema edit (and `npm run types:check` fails on drift).
 */
export function generatedSchemaShimTemplate(opts: SchemaInitOpts): string {
  const gitBlock = opts.pointerBranch
    ? `  git: {\n    baseBranch: '${opts.baseBranch}',\n    publishedPointerBranch: '${opts.pointerBranch}',\n  },`
    : `  git: { baseBranch: '${opts.baseBranch}' },`;
  return `/*
 * AUTO-GENERATED — DO NOT EDIT.
 * Generated from cms/schema.json.
 * Run \`npx octocms types:gen\` to regenerate.
 */

import { defineConfig } from 'octocms/defineConfig';

export const schema = defineConfig({
  projectName: '${opts.projectName}',
${gitBlock}
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif'],
  collections: {
    helloPage: {
      label: 'Hello Page',
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true, required: true },
        description: { label: 'Description', format: 'text' },
      },
    },
  },
});
`;
}

/**
 * `cms/octocms.config.ts` — thin TS binding. Imports the literal-typed
 * `schema` from the generated shim and re-exports it as `configOctoCMS` (the
 * runtime `Config`) and `OctoConfig` (the literal type used by `query()`).
 *
 * Hand-edits should go to `cms/schema.json`. After editing the JSON, run
 * `npx octocms types:gen` to refresh `cms/__generated__/schema.ts`.
 */
export function octoConfigTemplate(_opts: SchemaInitOpts): string {
  return `import type { Config } from 'octocms/types';
import { schema } from './__generated__/schema';

/**
 * The schema is defined in \`cms/schema.json\` (source of truth — hand-editable
 * and editable through the Content Model UI). \`npx octocms types:gen\` mirrors
 * it into \`cms/__generated__/schema.ts\` as a literal-typed \`defineConfig()\`
 * call so the downstream \`query()\` API can infer narrow collection / field /
 * format types (which a plain JSON import cannot preserve).
 *
 * \`npm run types:check\` fails if the JSON and the generated shim drift.
 */
const _typedConfigOctoCMS = schema;

/** Runtime config — widened to \`Config\` for dynamic indexing in CMS internals. */
export const configOctoCMS: Config = _typedConfigOctoCMS as Config;

/**
 * Exact literal type of the config — use this for type-level inference only
 * (e.g. the \`query()\` API derives collection/field names from it).
 */
export type OctoConfig = typeof _typedConfigOctoCMS;
`;
}

export function nextConfigTemplate(): string {
  return `import type { NextConfig } from 'next';
import { withOctoCMS } from 'octocms/config';
import { configOctoCMS } from './cms/octocms.config';

export { configOctoCMS } from './cms/octocms.config';
export type { OctoConfig } from './cms/octocms.config';

const nextConfig: NextConfig = {};

export default withOctoCMS(nextConfig, configOctoCMS);
`;
}

export function demoHelloPageJson(): string {
  return JSON.stringify(
    {
      sys: { id: '0000', type: 'helloPage', status: 'merged' },
      fields: {
        title: 'Hello World',
        description: 'Welcome to your new OctoCMS site! Edit this content in the CMS admin panel.',
      },
    },
    null,
    2,
  );
}

export const helloPageTemplate = `import { query } from 'cms/__generated__/query';

export default async function HelloPage() {
  const page = await query('helloPage').first();
  if (!page) return null;
  return (
    <main>
      <h1>{page.fields.title}</h1>
      <p>{page.fields.description}</p>
    </main>
  );
}
`;

export function readmeTemplate(projectName: string): string {
  return `# ${projectName}

Built with [OctoCMS](https://octocms.com) — a file-based CMS on Next.js.

## Setup

### 1. Install dependencies

\`\`\`bash
npm install octocms next-auth @tanstack/react-query @mdxeditor/editor \\
  @radix-ui/react-avatar @radix-ui/react-dialog @radix-ui/react-dropdown-menu \\
  @radix-ui/react-label @radix-ui/react-select @radix-ui/react-slot \\
  @radix-ui/react-tabs @radix-ui/react-toast \\
  clsx minisearch octokit \\
  react-markdown rehype-sanitize remark-gfm remark-mdx \\
  sharp slugify sonner zod
\`\`\`

> The exact list (with the right \`octocms\` version pin) is also printed by \`npx octocms init\` — copy it from there.

### 2. Create a GitHub App

Follow the [OctoCMS GitHub App setup guide](https://octocms.com/docs/github-app) to create a GitHub App for authentication.

### 3. Configure environment variables

Copy the values from your GitHub App into \`.env.local\`:

\`\`\`bash
# GitHub App credentials (required for CMS auth)
GITHUB_ID=your_github_app_client_id
GITHUB_SECRET=your_github_app_client_secret

# NextAuth (generate secret: openssl rand -base64 32)
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# GitHub repo for content storage (required in production)
GITHUB_REPO_OWNER=your_github_username_or_org
GITHUB_REPO_NAME=your_repo_name

# Optional: static GitHub token for private repos / higher API rate limits
# CMS_GITHUB_TOKEN=your_github_pat
\`\`\`

### 4. Run the dev server

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000/cms](http://localhost:3000/cms) to access the CMS admin.
`;
}

export function envLocalTemplate(): string {
  return `# GitHub App credentials (required for CMS auth)
# Create a GitHub App at: https://github.com/settings/apps/new
GITHUB_ID=
GITHUB_SECRET=

# NextAuth secret — generate with: openssl rand -base64 32
NEXTAUTH_SECRET=
NEXTAUTH_URL=http://localhost:3000

# GitHub repo for content storage (required in production)
GITHUB_REPO_OWNER=
GITHUB_REPO_NAME=

# Optional: static GitHub token for private repos or higher API rate limits
# CMS_GITHUB_TOKEN=
`;
}

const AGENT_DOCS_MARKER = '<!-- octocms:agent-docs -->';

export function agentsMdSection(): string {
  return `${AGENT_DOCS_MARKER}
## OctoCMS — AI Content Management

For tasks that involve creating, editing, or deleting CMS content directly (without the admin UI), read the auto-generated agent docs:

- **\`octocms/docs/overview.md\`** — How to find, create, update, and delete content entries via file operations
- **\`octocms/docs/schema.md\`** — Per-collection field definitions, example JSON, and file path conventions

These docs are generated from \`cms/octocms.config.ts\`. Regenerate after schema changes: \`npm run agent-docs:gen\`.`;
}

export function agentsMdTemplate(): string {
  return `# Project Guidelines

${agentsMdSection()}
`;
}

export function tsconfigPaths(): Record<string, string[]> {
  return {
    'cms/__generated__': ['./cms/__generated__/index.ts'],
    'cms/__generated__/*': ['./cms/__generated__/*'],
    '@/*': ['./src/*'],
  };
}
