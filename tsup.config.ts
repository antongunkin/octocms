import { readdirSync } from 'fs';
import { join } from 'path';

import { defineConfig } from 'tsup';

function listSourceFiles(dir: string, cwd: string): string[] {
  try {
    const names = readdirSync(join(cwd, dir), { recursive: true }) as unknown as string[];
    return names
      .filter(
        (n) =>
          (n.endsWith('.ts') || n.endsWith('.tsx')) &&
          !n.endsWith('.test.ts') &&
          !n.endsWith('.test.tsx') &&
          !n.endsWith('.d.ts'),
      )
      .map((n) => `${dir}/${n}`.replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

const external = [
  // User-app path resolved via the consumer's tsconfig — never bundled into
  // the package. registerConfig.ts side-imports this so admin server actions
  // initialise the config singleton on cold start.
  'cms/__generated__/configInit',
  /^cms\/__generated__\//,
  'next',
  'next/*',
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  '@octokit/oauth-app',
  '@octokit/oauth-app/*',
  'sharp',
  '@mdxeditor/editor',
  '@mdxeditor/editor/*',
  /^@radix-ui\//,
  '@tanstack/react-query',
  'octokit',

  'zod',
  'minisearch',
  'react-markdown',
  'rehype-sanitize',
  'remark-gfm',
  'remark-mdx',
  // Optional peer deps for the chat agent — kept external so absence at install time is fine
  '@anthropic-ai/sdk',
  '@huggingface/transformers',
  'mammoth',
  'openai',
  'pdfjs-dist',
  /^pdfjs-dist\//,
];

// jiti must be external for the CLI — tsup bundling it inlines CJS require() calls
// (require("os") etc.) that break at runtime in an ESM context.
const cliExternal = [...external, 'jiti'];

// ESM output uses .js; CJS output uses .cjs so both can coexist under "type":"module"
const esmOutExtension = () => ({ js: '.js', dts: '.d.ts' });
const cjsOutExtension = () => ({ js: '.cjs', dts: '.d.cts' });

// All non-CLI source files — each becomes a separate entry point preserving directory structure.
// `cli/lib/**` IS shipped as runtime ESM (separate from the bundled CLI entry) because admin
// server actions like `admin/actions/schema.ts` import `regenerateAll` / `validateConfig` from
// `../../cli/lib/*` at request time. `cli/index.ts` and `cli/commands/**` stay out — those are
// the CLI entry point bundled separately below.
const ROOT_FILES = [
  'index.ts',
  'query.ts',
  'config.ts',
  'defineConfig.ts',
  'types.ts',
  'withOctoCMS.ts',
  'github-public.ts',
];
const SOURCE_DIRS = ['admin', 'agent', 'components', 'hooks', 'lib', 'schema', 'utils', 'cli/lib'];
const IGNORE_FILES = new Set(['cli/index.ts']);

const allEntry = Object.fromEntries(
  [
    ...ROOT_FILES,
    ...SOURCE_DIRS.flatMap((d) => listSourceFiles(d, import.meta.dirname)).filter((f) => !IGNORE_FILES.has(f)),
  ].map((f) => [f.replace(/\.(ts|tsx)$/, ''), f]),
);

// CJS subset — only modules loaded by next.config.ts (jiti/CJS context)
const cjsEntry = {
  index: 'index.ts',
  query: 'query.ts',
  config: 'config.ts',
  defineConfig: 'defineConfig.ts',
  types: 'types.ts',
  withOctoCMS: 'withOctoCMS.ts',
  'agent/index': 'agent/index.ts',
  'lib/configStore': 'lib/configStore.ts',
  'components/public/index': 'components/public/index.ts',
};

export default defineConfig([
  // ESM build — all code, bundle: false preserves 'use client'/'use server' directives
  // DTS generated separately via tsc (see build script) — tsup DTS OOMs with 100+ entry points
  {
    entry: allEntry,
    format: ['esm'],
    dts: false,
    external,
    bundle: false,
    outExtension: esmOutExtension,
    sourcemap: true,
    clean: true,
  },
  // CJS build — used when next.config.ts is loaded by jiti (require() context).
  // bundle: false — same as ESM: transpile only. Bundling pulled in Lexical/MDXEditor
  // subgraph (top-level await) and inflated the CJS graph beyond what jiti needs.
  {
    entry: cjsEntry,
    format: ['cjs'],
    dts: false,
    external,
    bundle: false,
    outExtension: cjsOutExtension,
    sourcemap: true,
  },
  // CLI entry — shebang at top of cli/index.ts is preserved by tsup automatically
  {
    entry: { 'cli/index': 'cli/index.ts' },
    format: ['esm'],
    dts: false,
    external: cliExternal,
    outExtension: esmOutExtension,
    sourcemap: true,
  },
]);
