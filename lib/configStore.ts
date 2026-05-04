import type { Config } from '../types';

let _config: Config | null = null;

/**
 * Register the app config. Called once by `withOctoCMS()` in `next.config.ts`
 * and by the generated `cms/__generated__/configInit.ts` side-effect module
 * (ensures the singleton is populated even in serverless cold starts).
 */
export function setConfig(config: Config): void {
  _config = config;
}

/**
 * Read the registered app config. Throws if `setConfig()` has not been called.
 *
 * All `octocms/` code that needs the runtime config should call this function
 * instead of importing directly from the consumer's `cms/octocms.config.ts`.
 */
export function getConfig(): Config {
  if (!_config) {
    throw new Error(
      'OctoCMS config not initialized. Import `cms/__generated__/configInit` in your root `app/layout.tsx`, ' +
        'in `src/instrumentation.ts`, and on the admin catch-all `cms/[[...path]]/page.tsx` (server actions may skip layout). ' +
        'Also ensure `tsconfig.json` maps `cms/__generated__/*` to `./cms/__generated__/*` so admin server actions can load `configInit`. ' +
        'See docs/deployment-errors.md.',
    );
  }
  return _config;
}
