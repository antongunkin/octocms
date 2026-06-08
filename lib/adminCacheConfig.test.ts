import { describe, expect, it } from 'vitest';

import { DEFAULT_ADMIN_CACHE_CONFIG, resolveAdminCacheConfig } from './adminCacheConfig';

describe('resolveAdminCacheConfig', () => {
  it('uses defaults when admin.cache is omitted', () => {
    expect(resolveAdminCacheConfig({} as any)).toEqual(DEFAULT_ADMIN_CACHE_CONFIG);
  });

  it('merges partial package configuration', () => {
    expect(
      resolveAdminCacheConfig({
        admin: { cache: { branchRevalidateSeconds: 60 } },
      } as any),
    ).toEqual({
      enabled: true,
      branchRevalidateSeconds: 60,
      staleIfErrorSeconds: 86_400,
    });
  });
});
