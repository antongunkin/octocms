import { defineConfig } from 'tsup';

const external = ['next', 'react', 'react-dom', 'next-auth', 'sharp'];

// jiti must be external for the CLI — tsup bundling it inlines CJS require() calls
// (require("os") etc.) that break at runtime in an ESM context.
const cliExternal = [...external, 'jiti'];

// ESM output uses .js; CJS output uses .cjs so both can coexist under "type":"module"
const esmOutExtension = () => ({ js: '.js', dts: '.d.ts' });
const cjsOutExtension = () => ({ js: '.cjs', dts: '.d.cts' });

const publicEntry = {
  index: 'index.ts',
  query: 'query.ts',
  config: 'config.ts',
  defineConfig: 'defineConfig.ts',
  types: 'types.ts',
  withOctoCMS: 'withOctoCMS.ts',
  'components/public/index': 'components/public/index.ts',
};

export default defineConfig([
  // ESM build — used by Next.js bundler (webpack/Turbopack) for app code
  {
    entry: publicEntry,
    format: ['esm'],
    dts: true,
    external,
    outExtension: esmOutExtension,
    sourcemap: true,
    clean: true,
  },
  // CJS build — used when next.config.ts is loaded by jiti (require() context)
  {
    entry: publicEntry,
    format: ['cjs'],
    dts: false,
    external,
    outExtension: cjsOutExtension,
    sourcemap: true,
  },
  {
    // CLI entry — shebang at top of cli/index.ts is preserved by tsup automatically
    entry: { 'cli/index': 'cli/index.ts' },
    format: ['esm'],
    dts: false,
    external: cliExternal,
    outExtension: esmOutExtension,
    sourcemap: true,
  },
]);
