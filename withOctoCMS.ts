import path from 'path';
import type { NextConfig } from 'next';
import type { Config } from './types';
import { assertProductionEnvOrThrow } from './lib/deploymentEnv';

/**
 * Wraps a Next.js config to:
 *
 *  1. Validate the production environment when `NODE_ENV === 'production'`
 *     (fails the build with a clear diagnostic on missing GitHub env vars).
 *  2. Add resolve aliases so the bare specifier `cms/__generated__/configInit`
 *     resolves to the user's local file from anywhere — including imports
 *     inside `node_modules/octocms/dist/admin/actions/registerConfig.js`.
 *     Bundlers (Webpack / Turbopack) do NOT apply consumer `tsconfig.json`
 *     `paths` to files in `node_modules`, so the alias has to be set here.
 */
export function withOctoCMS(nextConfig: NextConfig = {}, _octoConfig: Config): NextConfig {
  if (process.env.NODE_ENV === 'production') {
    assertProductionEnvOrThrow();
  }

  const projectRoot = process.cwd();
  // Turbopack rejects absolute paths in `resolveAlias` (it treats a leading `/`
  // as a server-relative URL). Project-relative `./…` is the documented form.
  const configInitRel = './cms/__generated__/configInit.ts';
  const configInitAbs = path.resolve(projectRoot, 'cms/__generated__/configInit.ts');

  // The webpack callback's parameter types vary across Next versions and
  // even between duplicate `next` copies in the same install graph. We treat
  // the config opaquely (just patch `resolve.alias`) and let the consumer's
  // Next.js validate the final shape.
  type LooseWebpackConfig = { resolve?: { alias?: Record<string, unknown> } };
  const wrappedWebpack = (config: unknown, ctx: unknown) => {
    const userWebpack = nextConfig.webpack as ((c: unknown, ctx: unknown) => unknown) | undefined;
    const base = (typeof userWebpack === 'function' ? userWebpack(config, ctx) : config) as LooseWebpackConfig;
    base.resolve = base.resolve ?? {};
    base.resolve.alias = {
      ...base.resolve.alias,
      'cms/__generated__/configInit': configInitAbs,
    };
    return base;
  };

  return {
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      resolveAlias: {
        ...(nextConfig.turbopack?.resolveAlias as Record<string, string> | undefined),
        'cms/__generated__/configInit': configInitRel,
      },
    },
    webpack: wrappedWebpack as NextConfig['webpack'],
  };
}
