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
 * Minimal root layout written when `app/layout.tsx` does not already exist.
 * The configInit import is the critical side-effect; the rest is a Next.js
 * boilerplate shell.
 */
export const rootLayoutTemplate = `import '../cms/__generated__/configInit';
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
export const rootLayoutConfigInitImport = `import '../cms/__generated__/configInit';\n`;

export const adminLayoutTemplate = `import '../../cms/__generated__/configInit';
import 'octocms/globals.css';
import '@mdxeditor/editor/style.css';

export { AdminLayout as default, metadata } from 'octocms/admin';
`;

/**
 * Catch-all admin route — every \`/cms/*\` URL renders the package's
 * \`AdminApp\` server component, which dispatches to the right page and wraps
 * each branch in its own \`<Suspense fallback={<MatchingSkeleton/>}>\`.
 * One file in the user app; the package owns the routing.
 */
export const adminPageTemplate = `export { AdminApp as default } from 'octocms/admin';
`;

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
];

export const LEGACY_ADMIN_CATCH_ALL_TEMPLATES: ReadonlyArray<string> = [
  // 0.4.x — re-exported from the deep path.
  `export { AdminApp as default } from 'octocms/admin/AdminApp';
`,
];

export const nextAuthRouteTemplate = `import NextAuth from 'next-auth';
import { authOptions } from 'octocms/admin/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`;

/**
 * Build a thin re-export Route Handler for one of the chat-agent endpoints.
 *
 * The actual handler lives in `octocms/agent/proposalsApi.ts` (see
 * `acceptProposalRoute` / `rejectProposalRoute`). The user-app file just:
 *   1. side-effect-imports `cms/__generated__/configInit` so
 *      `getAgentConfig()` resolves on cold start (Route Handlers don't run
 *      `app/layout.tsx`); and
 *   2. re-exports the package handler as `POST`.
 *
 * `depth` is the number of `..` segments needed to reach the project root
 * from the route file's directory, so the import path resolves to
 * `cms/__generated__/configInit` regardless of where the route lives.
 * For `app/api/agent/proposals/accept/route.ts` that is 5; for the same
 * file under `src/app/...` it is 6.
 */
export function agentProposalRouteTemplate(opts: {
  /** Named export to pull from `octocms/agent`. */
  handlerExport: 'acceptProposalRoute' | 'rejectProposalRoute';
  /** Number of `..` segments from the route directory to project root. */
  depth: number;
}): string {
  const upDirs = '../'.repeat(opts.depth);
  return `// Side-effect import: registers \`configOctoCMS\` + \`agentConfig\` into the
// runtime stores so \`getAgentConfig()\` resolves on cold start. Route Handlers
// don't run \`app/layout.tsx\`, so this import has to live here.
import '${upDirs}cms/__generated__/configInit';

export { ${opts.handlerExport} as POST } from 'octocms/agent';
`;
}

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
 * `depth` is the number of `..` segments needed to reach the project root
 * from the route file's directory. For `app/api/agent/route.ts` that is 4;
 * for `src/app/api/agent/route.ts` it is 5.
 */
export function agentChatRouteTemplate(opts: { depth: number }): string {
  const upDirs = '../'.repeat(opts.depth);
  return `// Side-effect import: registers \`configOctoCMS\` + \`agentConfig\` into the
// runtime stores so \`getAgentConfig()\` resolves on cold start. Route Handlers
// don't run \`app/layout.tsx\`, so this import has to live here.
import '${upDirs}cms/__generated__/configInit';

export { chatRoute as POST, chatStatusRoute as GET } from 'octocms/agent';
`;
}

export function octoConfigTemplate(opts: { projectName: string; baseBranch: string; pointerBranch?: string }): string {
  const gitBlock = opts.pointerBranch
    ? `  git: {\n    baseBranch: '${opts.baseBranch}',\n    publishedPointerBranch: '${opts.pointerBranch}',\n  },`
    : `  git: { baseBranch: '${opts.baseBranch}' },`;

  return `import type { Config } from 'octocms/types';
import { defineConfig } from 'octocms/config';

const _typedConfigOctoCMS = defineConfig({
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

export const configOctoCMS: Config = _typedConfigOctoCMS;
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

### 1. Create a GitHub App

Follow the [OctoCMS GitHub App setup guide](https://octocms.com/docs/github-app) to create a GitHub App for authentication.

### 2. Configure environment variables

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

### 3. Run the dev server

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
