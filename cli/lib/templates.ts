/**
 * File templates used by `octocms init` and `octocms update`.
 */

export const adminLayoutTemplate = `import '../../../cms/__generated__/configInit';
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
    post: {
      label: 'Posts',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true, required: true },
        slug: { label: 'Slug', format: 'slug', slugSource: 'title', required: true },
        body: { label: 'Body', format: 'markdown' },
        publishedAt: { label: 'Published At', format: 'datetime', defaultNow: true },
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

export function demoPostJson(id: string): string {
  const now = new Date().toISOString();
  return JSON.stringify(
    {
      sys: { id, type: 'post', status: 'merged' },
      fields: {
        title: 'Hello World',
        slug: 'hello-world',
        publishedAt: now,
      },
    },
    null,
    2,
  );
}

export const demoPostMarkdown = `# Hello World

Welcome to your new OctoCMS site! This is a demo post.

Edit this content in the CMS admin panel at \`/cms\`.
`;

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
    'octocms/*': ['./octocms/*'],
    '@/*': ['./src/*'],
  };
}
