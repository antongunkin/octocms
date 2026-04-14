import { defineConfig } from 'tsup';

const external = ['next', 'react', 'react-dom', 'next-auth', 'sharp'];

// Output .js / .d.ts so the exports map entries match without needing "type": "module"
const outExtension = () => ({ js: '.js', dts: '.d.ts' });

export default defineConfig([
  {
    entry: {
      index: 'index.ts',
      query: 'query.ts',
      config: 'config.ts',
      defineConfig: 'defineConfig.ts',
      types: 'types.ts',
      withOctoCMS: 'withOctoCMS.ts',
      'components/public/index': 'components/public/index.ts',
    },
    format: ['esm'],
    dts: true,
    external,
    outExtension,
    sourcemap: true,
    clean: true,
  },
  {
    // CLI entry — shebang at top of cli/index.ts is preserved by tsup automatically
    entry: { 'cli/index': 'cli/index.ts' },
    format: ['esm'],
    dts: false,
    external,
    outExtension,
    sourcemap: true,
  },
]);
