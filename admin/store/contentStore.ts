/**
 * In-memory content store for the CMS admin UI.
 *
 * Module-level state persists across requests within the same warm serverless
 * instance (Vercel, Cloudflare, Node.js). A CMS admin session involves many
 * rapid clicks, so a warm store covers the entire interactive session.
 *
 * Read operations return cached data instantly; writes go to GitHub first
 * (source of truth) then update the store via applyMutation().
 */

import { getConfig } from '../../lib/configStore';
import { logCmsServerError } from '../../lib/cmsServerLog';
import { isMediaEntryPath } from '../../lib/mediaPath';
import { buildSearchIndex, type EntryForSearch } from '../../lib/searchIndex';

import { assertGitHubConfig, getPublicOctokits } from '../github';
import { fetchBranchContent } from './contentStoreFetch';
import type { BranchStoreData, StoredEntry, StoreMutation } from './contentStoreTypes';

// ---------------------------------------------------------------------------
// TTL configuration
// ---------------------------------------------------------------------------

/** Serve directly from cache without any background refresh. */
const FRESH_TTL_MS = 30_000; // 30 seconds

/** Serve stale data while triggering a background refresh. */
const STALE_TTL_MS = 300_000; // 5 minutes

// ---------------------------------------------------------------------------
// Module-level state (persists across requests in a warm serverless instance)
// ---------------------------------------------------------------------------

/** Branch name → cached store data. */
const stores = new Map<string, BranchStoreData>();

/** Branch name → in-flight fetch promise (deduplication). */
const inflight = new Map<string, Promise<BranchStoreData | null>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function age(store: BranchStoreData): number {
  return Date.now() - store.populatedAt;
}

function isFresh(store: BranchStoreData): boolean {
  return age(store) < FRESH_TTL_MS;
}

function isStale(store: BranchStoreData): boolean {
  return age(store) < STALE_TTL_MS;
}

/** Default branch from cookie or config. */
function resolveBranch(branch: string | undefined): string {
  return branch || getConfig().git.baseBranch;
}

/**
 * Deduplicated fetch: if another call for the same branch is already in flight,
 * reuse that promise instead of firing a second GitHub request.
 */
function deduplicatedFetch(branch: string): Promise<BranchStoreData | null> {
  const existing = inflight.get(branch);
  if (existing) return existing;

  const promise = doFetch(branch).finally(() => {
    inflight.delete(branch);
  });

  inflight.set(branch, promise);
  return promise;
}

async function doFetch(branch: string): Promise<BranchStoreData | null> {
  const { owner, repo } = assertGitHubConfig();
  const [octokit] = getPublicOctokits();

  if (!octokit) {
    logCmsServerError({
      operation: 'contentStore.fetch',
      branch,
      message: 'No Octokit client available for store fetch',
    });
    return null;
  }

  const result = await fetchBranchContent(octokit, owner, repo, branch);

  if (result) {
    stores.set(branch, result);
  }

  return result;
}

/**
 * Get or populate the store for a branch. Implements the three-tier strategy:
 * - Cache hit + fresh  → return immediately
 * - Cache hit + stale  → return stale, trigger background refresh
 * - Cache miss / expired → block on fetch
 */
async function ensureStore(branch: string): Promise<BranchStoreData | null> {
  const cached = stores.get(branch);

  if (cached && isFresh(cached)) {
    return cached;
  }

  if (cached && isStale(cached)) {
    // Return stale data immediately, refresh in background
    deduplicatedFetch(branch).catch(() => {
      /* background refresh — errors logged inside doFetch */
    });
    return cached;
  }

  // Cold start or expired — block on fetch
  return deduplicatedFetch(branch);
}

// ---------------------------------------------------------------------------
// Collection path helpers
// ---------------------------------------------------------------------------

function collectionFromPath(filePath: string): string | null {
  const config = getConfig();
  const prefix = `${config.contentFolder}/`;
  if (!filePath.startsWith(prefix)) return null;
  const relative = filePath.slice(prefix.length);
  const slashIdx = relative.indexOf('/');
  return slashIdx > 0 ? relative.slice(0, slashIdx) : null;
}

// ---------------------------------------------------------------------------
// Public API — Read operations
// ---------------------------------------------------------------------------

/**
 * Get a single file from the store. Returns the StoredEntry with pre-parsed
 * content and companion markdown already merged, or null if not found.
 *
 * Looks in both editorial entries and media entries (the store keeps them in
 * separate maps; consumers shouldn't have to know which).
 */
export async function getStoredFile(filePath: string, branch?: string): Promise<StoredEntry | null> {
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  if (!store) return null;
  return store.entries.get(filePath) ?? store.mediaEntries.get(filePath) ?? null;
}

/**
 * Get all content file paths for a collection (or all collections if '**').
 * Returns an array of normalized file paths.
 */
export async function getStoredContentFiles(collection: string, branch?: string): Promise<string[] | null> {
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  if (!store) return null;

  if (collection === '**') {
    // Return all editorial entry paths. Media lives in `mediaEntries` and is
    // not included by `getContentFiles('**')` callers.
    const all: string[] = [];
    for (const [path] of store.entries) {
      if (path.endsWith('.json')) {
        all.push(path);
      }
    }
    return all;
  }

  return store.byCollection.get(collection)?.slice() ?? [];
}

/**
 * Get all media entries from the store.
 */
export async function getStoredMediaEntries(branch?: string): Promise<Map<string, StoredEntry> | null> {
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  if (!store) return null;
  return store.mediaEntries;
}

/**
 * Get the cached SHA for a file path (used to skip the pre-read on save).
 * Returns null if the file is not in the store.
 */
export async function getStoredFileSha(filePath: string, branch?: string): Promise<string | null> {
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  if (!store) return null;
  return (store.entries.get(filePath) ?? store.mediaEntries.get(filePath))?.sha ?? null;
}

// ---------------------------------------------------------------------------
// Public API — Search index
// ---------------------------------------------------------------------------

/**
 * Get or lazily build the serialized MiniSearch index for admin search.
 * Rebuilds only when the store version has changed since the last build.
 */
export async function getOrBuildSearchIndex(branch?: string): Promise<string | null> {
  const config = getConfig();
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  if (!store) return null;

  if (store.searchIndex !== null && store.searchIndexVersion === store.version) {
    return store.searchIndex;
  }

  // Build from current entries — `store.entries` is editorial-only (media
  // lives in `store.mediaEntries`), so no per-path filter is needed.
  const entries: EntryForSearch[] = [];
  for (const [path, stored] of store.entries) {
    entries.push({
      path: path.replace(`${config.contentFolder}/`, ''),
      content: stored.content,
      companionContent: stored.companionMarkdown as Record<string, string>,
    });
  }

  const serialized = buildSearchIndex(entries, config);
  store.searchIndex = serialized;
  store.searchIndexVersion = store.version;
  return serialized;
}

// ---------------------------------------------------------------------------
// Public API — Write-through mutations
// ---------------------------------------------------------------------------

/**
 * Apply a write-through mutation to the in-memory store after a successful
 * GitHub write. This keeps the store consistent without a full re-fetch.
 */
export function applyMutation(branch: string, mutation: StoreMutation): void {
  const store = stores.get(branch);
  if (!store) return; // Store not populated yet — next read will fetch fresh data

  if (mutation.type === 'upsert') {
    const isMedia = isMediaEntryPath(mutation.path);
    const existing = isMedia ? store.mediaEntries.get(mutation.path) : store.entries.get(mutation.path);
    const entry: StoredEntry = {
      path: mutation.path,
      content: mutation.content,
      sha: mutation.sha,
      companionMarkdown: mutation.companions ? { ...mutation.companions } : (existing?.companionMarkdown ?? {}),
    };

    if (isMedia) {
      store.mediaEntries.set(mutation.path, entry);
    } else {
      store.entries.set(mutation.path, entry);

      // Update collection index
      const collection = collectionFromPath(mutation.path);
      if (collection) {
        const list = store.byCollection.get(collection);
        if (list) {
          if (!list.includes(mutation.path)) {
            list.push(mutation.path);
          }
        } else {
          store.byCollection.set(collection, [mutation.path]);
        }
      }
    }
  } else {
    // delete
    if (isMediaEntryPath(mutation.path)) {
      store.mediaEntries.delete(mutation.path);
    } else {
      store.entries.delete(mutation.path);

      const collection = collectionFromPath(mutation.path);
      if (collection) {
        const list = store.byCollection.get(collection);
        if (list) {
          const idx = list.indexOf(mutation.path);
          if (idx >= 0) list.splice(idx, 1);
        }
      }
    }
  }

  store.version++;
}

// ---------------------------------------------------------------------------
// Public API — Lifecycle
// ---------------------------------------------------------------------------

/**
 * Invalidate the store for a branch, forcing a fresh fetch on the next read.
 */
export function invalidateBranch(branch: string): void {
  stores.delete(branch);
  inflight.delete(branch);
}

/**
 * Pre-populate the store for a branch (e.g. after switching branches).
 * Non-blocking — returns a promise that resolves when the store is warm.
 */
export async function warmBranch(branch: string): Promise<void> {
  await deduplicatedFetch(branch);
}

/**
 * Check whether the store has data for a branch (for testing / diagnostics).
 */
export function hasStore(branch: string): boolean {
  return stores.has(branch);
}

/**
 * Get the current store data for a branch (for testing / diagnostics).
 * Returns undefined if no data is cached.
 */
export function getStoreSnapshot(branch: string): BranchStoreData | undefined {
  return stores.get(branch);
}

/**
 * Clear all stores (for testing).
 */
export function clearAllStores(): void {
  stores.clear();
  inflight.clear();
}
