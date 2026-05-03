import { defineConfig } from 'tsup';
import { globSync } from 'glob';

const external = [
  'next',
  'next/*',
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  'next-auth',
  'next-auth/*',
  'sharp',
  '@mdxeditor/editor',
  '@mdxeditor/editor/*',
  /^@radix-ui\//,
  '@tanstack/react-query',
  '@tanstack/react-query-devtools',
  'octokit',
  'sonner',
  'zod',
  'class-variance-authority',
  'clsx',
  'tailwind-merge',
  'lucide-react',
  'minisearch',
  'react-markdown',
  'rehype-sanitize',
  'remark-gfm',
  'remark-mdx',
  'slugify',
  'glob',
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

// All non-CLI source files — each becomes a separate entry point preserving directory structure
const allEntry = Object.fromEntries(
  globSync(
    [
      'index.ts',
      'query.ts',
      'config.ts',
      'defineConfig.ts',
      'types.ts',
      'withOctoCMS.ts',
      'github-public.ts',
      'admin/**/*.{ts,tsx}',
      'agent/**/*.{ts,tsx}',
      'components/**/*.{ts,tsx}',
      'hooks/**/*.{ts,tsx}',
      'lib/**/*.{ts,tsx}',
      'utils/**/*.{ts,tsx}',
    ],
    { ignore: ['**/*.test.{ts,tsx}', '**/*.d.ts', 'cli/**'], cwd: import.meta.dirname },
  ).map((f) => [f.replace(/\.(ts|tsx)$/, ''), f]),
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
  // CJS build — used when next.config.ts is loaded by jiti (require() context)
  {
    entry: cjsEntry,
    format: ['cjs'],
    dts: false,
    external,
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
