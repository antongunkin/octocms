import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      // The user-app path that admin/actions/registerConfig.ts side-imports.
      // Doesn't exist inside the package, so resolve it to an empty stub
      // during package tests — they never need to actually run configInit.
      'cms/__generated__/configInit': fileURLToPath(new URL('./scripts/test/configInitStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
  },
});
