import { afterEach, describe, expect, it, vi } from 'vitest';

import { isProductionMode } from './githubContentMode';

describe('githubContentMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true when CMS_FORCE_GITHUB_API is true', () => {
    vi.stubEnv('CMS_FORCE_GITHUB_API', 'true');
    vi.stubEnv('NODE_ENV', 'development');
    expect(isProductionMode()).toBe(true);
  });

  it('is true in any production NODE_ENV', () => {
    vi.stubEnv('CMS_FORCE_GITHUB_API', undefined);
    vi.stubEnv('NODE_ENV', 'production');
    expect(isProductionMode()).toBe(true);
  });

  it('is false in development when CMS_FORCE_GITHUB_API is unset', () => {
    vi.stubEnv('CMS_FORCE_GITHUB_API', undefined);
    vi.stubEnv('NODE_ENV', 'development');
    expect(isProductionMode()).toBe(false);
  });
});
