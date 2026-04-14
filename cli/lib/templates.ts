/**
 * File templates used by `octocms init` and `octocms update`.
 */

export const adminLayoutTemplate = `import '../../cms/__generated__/configInit';
import 'octocms/globals.css';
import '@mdxeditor/editor/style.css';

export { AdminLayout as default, metadata } from 'octocms/admin/pages/AdminLayout';
`;

export const adminPageTemplate = `export { AdminApp as default } from 'octocms/admin/AdminApp';
`;

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
