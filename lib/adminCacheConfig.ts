import type { AdminCacheConfig, Config } from '../types';

export type ResolvedAdminCacheConfig = {
  enabled: boolean;
  branchRevalidateSeconds: number;
  staleIfErrorSeconds: number;
};

export const DEFAULT_ADMIN_CACHE_CONFIG: ResolvedAdminCacheConfig = {
  enabled: true,
  branchRevalidateSeconds: 30,
  staleIfErrorSeconds: 86_400,
};

export function resolveAdminCacheConfig(config: Pick<Config, 'admin'>): ResolvedAdminCacheConfig {
  const cache: AdminCacheConfig | undefined = config.admin?.cache;
  return {
    enabled: cache?.enabled ?? DEFAULT_ADMIN_CACHE_CONFIG.enabled,
    branchRevalidateSeconds: cache?.branchRevalidateSeconds ?? DEFAULT_ADMIN_CACHE_CONFIG.branchRevalidateSeconds,
    staleIfErrorSeconds: cache?.staleIfErrorSeconds ?? DEFAULT_ADMIN_CACHE_CONFIG.staleIfErrorSeconds,
  };
}
