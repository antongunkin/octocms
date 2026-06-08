import { afterEach, describe, expect, it, vi } from 'vitest';

import { isProductionMode, isVercelBuildStep } from './githubContentMode';

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

describe('isVercelBuildStep', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is true on Vercel when VERCEL_REGION is unset (build step)', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_REGION', undefined);
    expect(isVercelBuildStep()).toBe(true);
  });

  it('is false on Vercel serverless runtime when VERCEL_REGION is set', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('VERCEL_REGION', 'iad1');
    expect(isVercelBuildStep()).toBe(false);
  });

  it('is false outside Vercel', () => {
    vi.stubEnv('VERCEL', undefined);
    vi.stubEnv('VERCEL_REGION', undefined);
    expect(isVercelBuildStep()).toBe(false);
  });
});
