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
      'OctoCMS config not initialized. Make sure withOctoCMS(nextConfig, config) is called in next.config.ts ' +
        'and cms/__generated__/configInit.ts is imported in your admin layout.',
    );
  }
  return _config;
}
