import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { queryKeys } from './keys';

/**
 * Domain names that mutation hooks pass to `invalidateAfterMutation`.
 * Each name maps to a fan-out list of root keys to invalidate so callers
 * don't have to remember cross-domain dependencies (e.g. schema edits also
 * invalidate the entries list because field renames bubble through).
 */
export type InvalidationDomain = 'entries' | 'media' | 'schema' | 'git' | 'agent';

/**
 * For each domain, the set of root keys that should be invalidated.
 * Cross-domain entries here encode "this mutation might affect that domain":
 * - `'schema'` → also `entries` (field renames change entry shapes)
 * - `'git'` → also `entries` (active branch flip changes which entries we read)
 */
const DOMAIN_TO_KEYS: Record<InvalidationDomain, readonly QueryKey[]> = {
  entries: [queryKeys.entries.all],
  media: [queryKeys.media.all],
  schema: [queryKeys.schema.all, queryKeys.entries.all],
  git: [queryKeys.git.all, queryKeys.entries.all],
  agent: [queryKeys.agent.all],
};

/**
 * Invalidate every query key associated with the given domains. Deduplicates
 * shared keys so cross-domain overlap (e.g. `['schema','git']` both pulling
 * in `['entries']`) doesn't fire `invalidateQueries` twice.
 *
 * Use from a mutation `onSuccess`:
 *
 * ```ts
 * onSuccess: () => invalidateAfterMutation(qc, ['entries', 'git'])
 * ```
 */
export function invalidateAfterMutation(qc: QueryClient, domains: InvalidationDomain[]): void {
  const seen = new Set<string>();
  for (const domain of domains) {
    for (const key of DOMAIN_TO_KEYS[domain]) {
      const fingerprint = JSON.stringify(key);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      qc.invalidateQueries({ queryKey: key });
    }
  }
}
