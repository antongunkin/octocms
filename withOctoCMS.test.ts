import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Config } from './types';
import { withOctoCMS } from './withOctoCMS';

const stubConfig: Config = {
  projectName: 'Test',
  git: { baseBranch: 'main' },
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png'],
  collections: {},
};

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  // withOctoCMS calls assertProductionEnvOrThrow when NODE_ENV === 'production'.
  // Tests run in `test` mode so this never fires; explicit reset for clarity.
  (process.env as Record<string, string | undefined>).NODE_ENV = 'test';
});

afterEach(() => {
  const env = process.env as Record<string, string | undefined>;
  if (ORIGINAL_NODE_ENV === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = ORIGINAL_NODE_ENV;
});

describe('withOctoCMS', () => {
  it('preserves the user-supplied Next.js config', () => {
    const out = withOctoCMS({ reactStrictMode: true }, stubConfig);
    expect(out.reactStrictMode).toBe(true);
  });

  it('enables cacheComponents for the admin remote cache', () => {
    const out = withOctoCMS({}, stubConfig);
    expect(out.cacheComponents).toBe(true);
  });

  it('rejects explicitly disabled cacheComponents', () => {
    expect(() => withOctoCMS({ cacheComponents: false }, stubConfig)).toThrow('requires Next.js cacheComponents');
  });

  it('registers a Turbopack resolveAlias for cms/__generated__/configInit (project-relative)', () => {
    const out = withOctoCMS({}, stubConfig);
    const alias = (out.turbopack?.resolveAlias as Record<string, string> | undefined) ?? {};
    // Turbopack rejects absolute paths (treats leading `/` as server-relative URL),
    // so the alias must be project-relative.
    expect(alias['cms/__generated__/configInit']).toBe('./cms/__generated__/configInit.ts');
  });

  it('registers a Webpack resolve.alias pointing at the absolute file path', () => {
    const out = withOctoCMS({}, stubConfig);
    expect(typeof out.webpack).toBe('function');
    const config: { resolve?: { alias?: Record<string, string> } } = {};
    const result = (out.webpack as (c: typeof config, ctx: unknown) => typeof config)(config, {});
    const expected = path.resolve(process.cwd(), 'cms/__generated__/configInit.ts');
    expect(result.resolve?.alias?.['cms/__generated__/configInit']).toBe(expected);
  });

  it('merges with an existing webpack callback rather than overwriting it', () => {
    let userCallbackRan = false;
    const out = withOctoCMS(
      {
        webpack: (config: { resolve?: { alias?: Record<string, string> }; userMarker?: boolean }) => {
          userCallbackRan = true;
          config.userMarker = true;
          config.resolve = { alias: { 'user-alias': '/some/path' } };
          return config;
        },
      },
      stubConfig,
    );
    const config: { resolve?: { alias?: Record<string, string> }; userMarker?: boolean } = {};
    const result = (out.webpack as (c: typeof config, ctx: unknown) => typeof config)(config, {});
    expect(userCallbackRan).toBe(true);
    expect(result.userMarker).toBe(true);
    expect(result.resolve?.alias?.['user-alias']).toBe('/some/path');
    expect(result.resolve?.alias?.['cms/__generated__/configInit']).toBe(
      path.resolve(process.cwd(), 'cms/__generated__/configInit.ts'),
    );
  });

  it('merges with an existing turbopack.resolveAlias rather than overwriting it', () => {
    const out = withOctoCMS(
      {
        turbopack: {
          resolveAlias: { 'user-alias': './user' } as Record<string, string>,
        },
      },
      stubConfig,
    );
    const alias = (out.turbopack?.resolveAlias as Record<string, string> | undefined) ?? {};
    expect(alias['user-alias']).toBe('./user');
    expect(alias['cms/__generated__/configInit']).toBe('./cms/__generated__/configInit.ts');
  });

  it('does not throw when NODE_ENV is not production (no env vars set)', () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
    expect(() => withOctoCMS({}, stubConfig)).not.toThrow();
  });
});
