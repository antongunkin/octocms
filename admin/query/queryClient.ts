import { QueryClient } from '@tanstack/react-query';

/**
 * Default options aligned with the server-side warm `contentStore` cache
 * (see `octocms/admin/store/contentStore.ts` — FRESH_TTL_MS = 30s).
 *
 * Keeping `staleTime` at 30s means navigating between admin pages reuses
 * the in-memory cache without refetching, while a background refetch on
 * mount keeps data within the same freshness window the server tier uses.
 */
const DEFAULT_OPTIONS = {
  queries: {
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  },
} as const;

export function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: DEFAULT_OPTIONS });
}

let browserClient: QueryClient | undefined;

/**
 * Singleton QueryClient for the browser. Server contexts get a fresh
 * client per call to avoid cross-request cache leaks.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserClient) {
    browserClient = makeQueryClient();
  }
  return browserClient;
}
