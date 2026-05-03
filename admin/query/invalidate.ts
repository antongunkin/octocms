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

/** Same-origin channel so other `/cms` tabs refetch after mutations (Phase 6). */
export const OCTOCMS_QUERY_INVALIDATE_CHANNEL = 'octocms:invalidate' as const;

const CROSS_TAB_MSG_V = 1 as const;

export type CrossTabInvalidatePayload = {
  v: typeof CROSS_TAB_MSG_V;
  domains: InvalidationDomain[];
};

function isInvalidationDomain(x: unknown): x is InvalidationDomain {
  return x === 'entries' || x === 'media' || x === 'schema' || x === 'git' || x === 'agent';
}

/** Parse `BroadcastChannel` payloads; returns `null` if malformed. */
export function parseCrossTabInvalidatePayload(data: unknown): InvalidationDomain[] | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (d.v !== CROSS_TAB_MSG_V || !Array.isArray(d.domains)) return null;
  if (!d.domains.every(isInvalidationDomain)) return null;
  return d.domains as InvalidationDomain[];
}

function invalidateDomainQueryPromises(qc: QueryClient, domains: InvalidationDomain[]): Promise<unknown>[] {
  const seen = new Set<string>();
  const tasks: Promise<unknown>[] = [];
  for (const domain of domains) {
    for (const key of DOMAIN_TO_KEYS[domain]) {
      const fingerprint = JSON.stringify(key);
      if (seen.has(fingerprint)) continue;
      seen.add(fingerprint);
      // `refetchType: 'all'` so background tabs (and any mounted-but-idle
      // observers) refetch after cross-tab `BroadcastChannel` invalidation,
      // not only the focused window's "active" queries.
      tasks.push(qc.invalidateQueries({ queryKey: key, refetchType: 'all' }));
    }
  }
  return tasks;
}

/**
 * Local invalidation only (no broadcast). Used by the cross-tab listener so
 * sibling tabs update without echoing another broadcast.
 */
export function applyDomainInvalidation(qc: QueryClient, domains: InvalidationDomain[]): void {
  void Promise.all(invalidateDomainQueryPromises(qc, domains));
}

/**
 * Notify other same-origin tabs to run the same domain invalidation. No-op in
 * SSR, when `BroadcastChannel` is unavailable, or when `domains` is empty.
 */
export function postCrossTabInvalidation(domains: InvalidationDomain[]): void {
  if (typeof BroadcastChannel === 'undefined' || domains.length === 0) return;
  let ch: BroadcastChannel | undefined;
  try {
    ch = new BroadcastChannel(OCTOCMS_QUERY_INVALIDATE_CHANNEL);
    const payload: CrossTabInvalidatePayload = { v: CROSS_TAB_MSG_V, domains: [...domains] };
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel#postMessage(message) has no targetOrigin (unlike Window#postMessage).
    ch.postMessage(payload);
    const port = ch;
    // Close on a later task so delivery isn't tied to synchronous teardown
    // in tight mutation → postMessage → close sequences (browser-dependent).
    queueMicrotask(() => port.close());
  } catch {
    ch?.close();
  }
}

/**
 * Subscribe to cross-tab invalidation messages for this `QueryClient`.
 * Returns a disposer (close channel). Safe to call from a client `useEffect`.
 */
export function attachCrossTabInvalidationListener(qc: QueryClient): () => void {
  if (typeof BroadcastChannel === 'undefined') {
    return () => {};
  }
  let ch: BroadcastChannel;
  try {
    ch = new BroadcastChannel(OCTOCMS_QUERY_INVALIDATE_CHANNEL);
  } catch {
    return () => {};
  }
  const handler = (ev: MessageEvent<unknown>) => {
    const domains = parseCrossTabInvalidatePayload(ev.data);
    if (!domains || domains.length === 0) return;
    applyDomainInvalidation(qc, domains);
  };
  ch.addEventListener('message', handler);
  return () => {
    ch.removeEventListener('message', handler);
    ch.close();
  };
}

/**
 * Await local invalidation fan-out, then broadcast to sibling tabs. Use when
 * the next step (e.g. a follow-up chat request) must see refreshed cache data.
 */
export async function invalidateAfterMutationAsync(qc: QueryClient, domains: InvalidationDomain[]): Promise<void> {
  await Promise.all(invalidateDomainQueryPromises(qc, domains));
  postCrossTabInvalidation(domains);
}

/**
 * Invalidate every query key associated with the given domains. Deduplicates
 * shared keys so cross-domain overlap (e.g. `['schema','git']` both pulling
 * in `['entries']`) doesn't fire `invalidateQueries` twice. Also notifies other
 * admin tabs via `BroadcastChannel` (same payload shape as local fan-out).
 *
 * Use from a mutation `onSuccess`:
 *
 * ```ts
 * onSuccess: () => invalidateAfterMutation(qc, ['entries', 'git'])
 * ```
 */
export function invalidateAfterMutation(qc: QueryClient, domains: InvalidationDomain[]): void {
  applyDomainInvalidation(qc, domains);
  postCrossTabInvalidation(domains);
}
