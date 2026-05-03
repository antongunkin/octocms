'use client';

import { useQuery, type QueryKey, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';

/**
 * Named cache tiers so hooks declare intent rather than copy-pasting magic
 * `staleTime` numbers. Defaults align with the server-side warm cache in
 * `octocms/admin/store/contentStore.ts` (FRESH_TTL_MS = 30s).
 */
export const CACHE_TIERS = {
  /** Static-for-session data: schema, agent enablement, isProduction. */
  static: { staleTime: Number.POSITIVE_INFINITY, gcTime: Number.POSITIVE_INFINITY },
  /** Default: aligned with server-side `contentStore` FRESH_TTL_MS. */
  normal: { staleTime: 30_000, gcTime: 5 * 60_000 },
  /** Frequently-changing data: branch state, commit history. */
  realtime: { staleTime: 5_000, gcTime: 60_000 },
} as const;

export type CacheTier = keyof typeof CACHE_TIERS;

/**
 * Thin wrapper around `useQuery` that applies a `CACHE_TIERS` preset based on
 * the `tier` option. Caller-supplied options (including `staleTime`) win over
 * the tier defaults so case-by-case overrides stay possible.
 */
export function useAdminQuery<
  TQueryFnData,
  TError = Error,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: UseQueryOptions<TQueryFnData, TError, TData, TQueryKey> & { tier?: CacheTier },
): UseQueryResult<TData, TError> {
  const { tier = 'normal', ...rest } = options;
  return useQuery({ ...CACHE_TIERS[tier], ...rest });
}
