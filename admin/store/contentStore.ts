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
import { resolveAdminCacheConfig } from '../../lib/adminCacheConfig';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { logCmsServerError } from '../../lib/cmsServerLog';
import { isMediaEntryPath } from '../../lib/mediaPath';
import { buildSearchIndex, type EntryForSearch } from '../../lib/searchIndex';

import { assertGitHubConfig, getAdminReadOctokits } from '../github';
import {
  fetchBlobContents,
  fetchBranchContent,
  mapBlobContentsToFiles,
  type BranchManifestItem,
} from './contentStoreFetch';
import {
  fetchNextCachedBranchContent,
  fetchNextCachedContentFiles,
  invalidateNextBranchCache,
} from './contentStoreNextCache';
import type {
  AdminCacheStatus,
  BranchStoreData,
  StoredEntry,
  StoredEntryListSnapshot,
  StoreMutation,
} from './contentStoreTypes';

// ---------------------------------------------------------------------------
// Module-level state (persists across requests in a warm serverless instance)
// ---------------------------------------------------------------------------

/** Branch name → cached store data. */
const stores = new Map<string, BranchStoreData>();

/** Branch name → in-flight fetch promise (deduplication). */
const inflight = new Map<string, Promise<BranchStoreData | null>>();

/** Branch + ordered companion paths → in-flight lazy hydration. */
const companionInflight = new Map<string, Promise<void>>();

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function age(store: BranchStoreData): number {
  return Date.now() - store.populatedAt;
}

function isFresh(store: BranchStoreData): boolean {
  return age(store) < resolveAdminCacheConfig(getConfig()).branchRevalidateSeconds * 1000;
}

function canServeStale(store: BranchStoreData): boolean {
  return age(store) < resolveAdminCacheConfig(getConfig()).staleIfErrorSeconds * 1000;
}

/** Default branch from cookie or config. */
function resolveBranch(branch: string | undefined): string {
  return branch || getConfig().git.baseBranch;
}

function normalizeStoreData(store: BranchStoreData): BranchStoreData {
  store.headSha ??= null;
  store.fileShas ??= new Map(
    [...store.entries.values(), ...store.mediaEntries.values()].map((entry) => [entry.path, entry.sha]),
  );
  store.fileSizes ??= new Map();
  store.reverseEntryReferences ??= new Map();
  store.reverseMediaReferences ??= new Map();
  store.loadedCompanionPaths ??= new Set();
  store.cacheStatus ??= 'fresh';
  store.cacheError ??= null;
  return store;
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
  const octokits = await getAdminReadOctokits();
  const cacheConfig = resolveAdminCacheConfig(getConfig());
  const hasStaticReadToken = !!process.env.CMS_GITHUB_TOKEN?.trim();

  if (octokits.length === 0) {
    logCmsServerError({
      operation: 'contentStore.fetch',
      branch,
      message: 'No Octokit client available for store fetch',
    });
    return null;
  }

  let result: BranchStoreData | null = null;

  // Remote cache is shared across users and cannot use per-session OAuth tokens.
  // Skip it when only the signed-in user's token can read a private repository.
  if (cacheConfig.enabled && hasStaticReadToken) {
    try {
      result = await fetchNextCachedBranchContent(owner, repo, branch, cacheConfig);
    } catch (error) {
      logCmsServerError({
        operation: 'contentStore.fetchCached',
        branch,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Direct recovery keeps self-hosted/test runtimes working if Next's cache
  // handler is unavailable and is also the true cold-start fallback.
  if (!result) {
    for (const octokit of octokits) {
      result = await fetchBranchContent(octokit, owner, repo, branch);
      if (result) break;
    }
  }

  if (result) {
    normalizeStoreData(result);
    if (age(result) >= cacheConfig.staleIfErrorSeconds * 1000) {
      return null;
    }
    if (age(result) >= cacheConfig.branchRevalidateSeconds * 1000) {
      result.cacheStatus = 'stale';
      result.cacheError = 'GitHub could not confirm the current branch HEAD.';
    } else {
      result.cacheStatus = 'fresh';
      result.cacheError = null;
    }
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
    cached.cacheStatus = 'fresh';
    cached.cacheError = null;
    return cached;
  }

  if (cached && canServeStale(cached)) {
    const failedPreviousRefresh = cached.cacheStatus === 'stale';
    if (!failedPreviousRefresh) cached.cacheStatus = 'syncing';
    deduplicatedFetch(branch)
      .then((refreshed) => {
        if (!refreshed && stores.get(branch) === cached) {
          cached.cacheStatus = 'stale';
          cached.cacheError = 'GitHub could not confirm the current branch HEAD.';
        }
      })
      .catch((error) => {
        if (stores.get(branch) === cached) {
          cached.cacheStatus = 'stale';
          cached.cacheError = error instanceof Error ? error.message : String(error);
        }
      });
    return cached;
  }

  const refreshed = await deduplicatedFetch(branch);
  if (refreshed) return refreshed;

  if (cached) {
    cached.cacheStatus = 'unavailable';
    cached.cacheError = 'The cached admin snapshot expired and GitHub is unavailable.';
  }
  return null;
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

function companionPathsForEntry(entry: StoredEntry): Record<string, string> {
  const config = getConfig();
  const type = (entry.content as { sys?: { type?: unknown } }).sys?.type;
  if (typeof type !== 'string' || !config.collections) return {};
  return {
    ...companionMarkdownPathsForEntry(entry.path, type, config.collections),
    ...companionRichTextPathsForEntry(entry.path, type, config.collections),
  };
}

async function hydrateCompanions(store: BranchStoreData, entries: readonly StoredEntry[]): Promise<void> {
  const targetsByPath = new Map<string, { entry: StoredEntry; fieldName: string }[]>();

  for (const entry of entries) {
    for (const [fieldName, companionPath] of Object.entries(companionPathsForEntry(entry))) {
      if (store.loadedCompanionPaths.has(companionPath) || !store.fileShas.has(companionPath)) continue;
      const targets = targetsByPath.get(companionPath);
      if (targets) targets.push({ entry, fieldName });
      else targetsByPath.set(companionPath, [{ entry, fieldName }]);
    }
  }

  if (targetsByPath.size === 0) return;
  const paths = Array.from(targetsByPath.keys()).sort();
  const inflightKey = `${store.branch}:${paths.join('\n')}`;
  const existing = companionInflight.get(inflightKey);
  if (existing) return existing;

  const promise = (async () => {
    const { owner, repo } = assertGitHubConfig();
    const items: BranchManifestItem[] = paths.map((path) => ({
      path,
      sha: store.fileShas.get(path) ?? '',
      size: store.fileSizes.get(path) ?? 0,
    }));
    const cacheConfig = resolveAdminCacheConfig(getConfig());
    let files = null;

    if (cacheConfig.enabled) {
      try {
        files = await fetchNextCachedContentFiles(owner, repo, items);
      } catch {
        // Direct recovery below.
      }
    }

    if (!files) {
      for (const octokit of await getAdminReadOctokits()) {
        const blobs = await fetchBlobContents(
          octokit,
          owner,
          repo,
          items.map((item) => item.sha),
        );
        if (blobs.some((blob) => blob.content !== null)) {
          files = mapBlobContentsToFiles(items, blobs);
          break;
        }
      }
    }
    if (!files) return;

    const contentByPath = new Map(files.map((file) => [file.path, file.content]));
    const nextCompanions = new Map<StoredEntry, Record<string, string>>();

    for (const [companionPath, targets] of targetsByPath) {
      const content = contentByPath.get(companionPath);
      if (content === null || content === undefined) continue;
      store.loadedCompanionPaths.add(companionPath);
      for (const { entry, fieldName } of targets) {
        const companions = nextCompanions.get(entry) ?? { ...entry.companionMarkdown };
        companions[fieldName] = content;
        nextCompanions.set(entry, companions);
      }
    }

    for (const [entry, companions] of nextCompanions) {
      entry.companionMarkdown = companions;
    }
  })().finally(() => {
    companionInflight.delete(inflightKey);
  });

  companionInflight.set(inflightKey, promise);
  return promise;
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
  const entry = store.entries.get(filePath) ?? store.mediaEntries.get(filePath) ?? null;
  if (entry && store.entries.has(filePath)) {
    await hydrateCompanions(store, [entry]);
  }
  return entry;
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
 * Read list-view metadata and media lookup data from one store snapshot.
 * Companion content is intentionally not hydrated because list views do not
 * use it.
 */
export async function getStoredEntryListSnapshot(
  collection: string,
  branch?: string,
): Promise<StoredEntryListSnapshot | null> {
  const store = await ensureStore(resolveBranch(branch));
  if (!store) return null;

  const paths =
    collection === '**'
      ? Array.from(store.entries.keys()).filter((filePath) => filePath.endsWith('.json'))
      : (store.byCollection.get(collection) ?? []);
  const entries: StoredEntry[] = [];

  for (const filePath of paths) {
    const entry = store.entries.get(filePath);
    if (entry) entries.push(entry);
  }

  return {
    entries,
    mediaEntries: Array.from(store.mediaEntries.values()),
  };
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
  return store.fileShas.get(filePath) ?? (store.entries.get(filePath) ?? store.mediaEntries.get(filePath))?.sha ?? null;
}

export async function getStoredEntryReferencePaths(
  targetReferenceKey: string,
  branch?: string,
): Promise<string[] | null> {
  const store = await ensureStore(resolveBranch(branch));
  if (!store) return null;
  return store.reverseEntryReferences.get(targetReferenceKey)?.slice() ?? [];
}

export async function getStoredMediaReferencePaths(mediaId: string, branch?: string): Promise<string[] | null> {
  const store = await ensureStore(resolveBranch(branch));
  if (!store) return null;
  return store.reverseMediaReferences.get(mediaId)?.slice() ?? [];
}

export async function getContentStoreStatus(branch?: string): Promise<{
  status: AdminCacheStatus;
  error: string | null;
  branch: string;
  headSha: string | null;
}> {
  const resolved = resolveBranch(branch);
  const store = await ensureStore(resolved);
  return {
    status: store?.cacheStatus ?? 'unavailable',
    error: store?.cacheError ?? 'Content is not available from GitHub.',
    branch: resolved,
    headSha: store?.headSha ?? null,
  };
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

  await hydrateCompanions(store, Array.from(store.entries.values()));

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

  removePathFromReverseIndexes(store, mutation.path);

  if (mutation.type === 'upsert') {
    const isMedia = isMediaEntryPath(mutation.path);
    const existing = isMedia ? store.mediaEntries.get(mutation.path) : store.entries.get(mutation.path);
    const entry: StoredEntry = {
      path: mutation.path,
      content: mutation.content,
      sha: mutation.sha,
      companionMarkdown: mutation.companions ? { ...mutation.companions } : (existing?.companionMarkdown ?? {}),
    };
    store.fileShas.set(mutation.path, mutation.sha);

    if (isMedia) {
      store.mediaEntries.set(mutation.path, entry);
    } else {
      store.entries.set(mutation.path, entry);
      indexEntryReferences(store, entry);
      if (mutation.companions) {
        for (const companionPath of Object.values(companionPathsForEntry(entry))) {
          store.loadedCompanionPaths.add(companionPath);
        }
      }

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
      const existing = store.entries.get(mutation.path);
      if (existing) {
        for (const companionPath of Object.values(companionPathsForEntry(existing))) {
          store.fileShas.delete(companionPath);
          store.fileSizes.delete(companionPath);
          store.loadedCompanionPaths.delete(companionPath);
        }
      }
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
    store.fileShas.delete(mutation.path);
  }

  store.version++;
  store.searchIndex = null;
  store.searchIndexVersion = -1;
}

function referenceKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((key): key is string => typeof key === 'string' && key.length > 0);
  }
  if (typeof value !== 'string' || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((key): key is string => typeof key === 'string' && key.length > 0);
    }
  } catch {
    // Single references are plain strings.
  }
  return [value];
}

function addReverseIndex(index: Map<string, string[]>, key: string, sourcePath: string): void {
  const paths = index.get(key);
  if (!paths) index.set(key, [sourcePath]);
  else if (!paths.includes(sourcePath)) paths.push(sourcePath);
}

function indexEntryReferences(store: BranchStoreData, entry: StoredEntry): void {
  const config = getConfig();
  const type = (entry.content as { sys?: { type?: unknown } }).sys?.type;
  const fields = (entry.content as { fields?: Record<string, unknown> }).fields;
  if (typeof type !== 'string' || !fields || !config.collections) return;
  const collection = config.collections[type as keyof typeof config.collections];
  if (!collection) return;

  for (const [fieldName, fieldConfig] of Object.entries(collection.fields)) {
    const values = referenceKeys(fields[fieldName]);
    if (fieldConfig.format === 'reference') {
      for (const key of values) addReverseIndex(store.reverseEntryReferences, key, entry.path);
    } else if (fieldConfig.format === 'image') {
      for (const mediaId of values) addReverseIndex(store.reverseMediaReferences, mediaId, entry.path);
    }
  }
}

function removePathFromReverseIndexes(store: BranchStoreData, sourcePath: string): void {
  for (const index of [store.reverseEntryReferences, store.reverseMediaReferences]) {
    for (const [key, paths] of index) {
      const filtered = paths.filter((path) => path !== sourcePath);
      if (filtered.length === 0) index.delete(key);
      else if (filtered.length !== paths.length) index.set(key, filtered);
    }
  }
}

/**
 * Apply mutations only after GitHub confirms the atomic commit, then expire
 * the shared branch manifest while retaining immutable blob chunks.
 */
export function applyCommittedMutations(branch: string, headSha: string, mutations: readonly StoreMutation[]): void {
  for (const mutation of mutations) applyMutation(branch, mutation);

  const store = stores.get(branch);
  if (store) {
    store.headSha = headSha;
    store.populatedAt = Date.now();
    store.cacheStatus = 'fresh';
    store.cacheError = null;
  }

  const { owner, repo } = assertGitHubConfig();
  invalidateNextBranchCache(owner, repo, branch);

  // Preload the confirmed branch in the background for the next admin view.
  deduplicatedFetch(branch).catch(() => {
    /* The write-through L1 snapshot remains usable. */
  });
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
  for (const key of companionInflight.keys()) {
    if (key.startsWith(`${branch}:`)) companionInflight.delete(key);
  }
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
  companionInflight.clear();
}
