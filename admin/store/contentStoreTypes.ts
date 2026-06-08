/**
 * Type definitions for the in-memory content store.
 *
 * The store caches parsed CMS content per branch, enabling instant reads
 * for the admin UI. GitHub remains the source of truth; the store is a
 * read-through cache with write-through mutations on save/create/delete.
 */

/** A single parsed content entry held in the store. */
export type StoredEntry = {
  /** Normalized forward-slash path, e.g. "cms/content/post/post-123.json" */
  path: string;
  /** Parsed JSON content (sys + fields). */
  content: Record<string, unknown>;
  /** Git blob SHA — used for write conflict detection and to skip pre-read on save. */
  sha: string;
  /** Companion markdown content keyed by field name (e.g. { body: "# Hello" }). */
  companionMarkdown: Readonly<Record<string, string>>;
};

export type StoredEntryListSnapshot = {
  entries: StoredEntry[];
  mediaEntries: StoredEntry[];
};

export type AdminCacheStatus = 'fresh' | 'stale' | 'syncing' | 'unavailable';

export type SerializedStoredEntry = {
  path: string;
  content: Record<string, unknown>;
  sha: string;
  companionMarkdown: Record<string, string>;
};

/** Immutable snapshot of all content for a single branch. */
export type BranchStoreData = {
  /** Branch name this data belongs to. */
  branch: string;
  /** Git commit SHA at the branch head used to populate this snapshot. */
  headSha: string | null;
  /** Git tree SHA used to populate this snapshot. */
  treeSha: string;
  /** Every CMS-managed path → blob SHA, including companion content files. */
  fileShas: Map<string, string>;
  /** Every CMS-managed path → Git-reported blob size. */
  fileSizes: Map<string, number>;
  /** All content entries indexed by normalized file path. */
  entries: Map<string, StoredEntry>;
  /** Collection name → list of entry file paths (for fast listing). */
  byCollection: Map<string, string[]>;
  /** Media JSON entry paths indexed separately for fast media queries. */
  mediaEntries: Map<string, StoredEntry>;
  /** Referenced entry key → source entry paths. */
  reverseEntryReferences: Map<string, string[]>;
  /** Media ID → source entry paths that use it. */
  reverseMediaReferences: Map<string, string[]>;
  /** Companion paths already hydrated into entry records. */
  loadedCompanionPaths: Set<string>;
  /** Freshness state for the current admin snapshot. */
  cacheStatus: AdminCacheStatus;
  /** Last refresh error message when cacheStatus is stale/unavailable. */
  cacheError: string | null;
  /** Timestamp (Date.now()) when the store was last populated from GitHub. */
  populatedAt: number;
  /** Monotonically increasing counter, bumped on each write-through mutation. */
  version: number;
  /** Serialized MiniSearch JSON for admin search. null = not yet built. */
  searchIndex: string | null;
  /** Store version when searchIndex was last built. */
  searchIndexVersion: number;
};

export type SerializedBranchStoreData = {
  branch: string;
  headSha: string | null;
  treeSha: string;
  fileShas: [string, string][];
  fileSizes: [string, number][];
  entries: SerializedStoredEntry[];
  byCollection: [string, string[]][];
  mediaEntries: SerializedStoredEntry[];
  reverseEntryReferences: [string, string[]][];
  reverseMediaReferences: [string, string[]][];
  loadedCompanionPaths: string[];
  populatedAt: number;
  version: number;
};

/** Discriminated union for write-through store mutations. */
export type StoreMutation =
  | {
      type: 'upsert';
      path: string;
      content: Record<string, unknown>;
      sha: string;
      companions?: Record<string, string>;
    }
  | { type: 'delete'; path: string };

function serializeEntries(map: Map<string, StoredEntry>): SerializedStoredEntry[] {
  return Array.from(map.values(), (entry) => ({
    path: entry.path,
    content: entry.content,
    sha: entry.sha,
    companionMarkdown: { ...entry.companionMarkdown },
  }));
}

function deserializeEntries(entries: SerializedStoredEntry[]): Map<string, StoredEntry> {
  return new Map(
    entries.map((entry) => [
      entry.path,
      {
        path: entry.path,
        content: entry.content,
        sha: entry.sha,
        companionMarkdown: { ...entry.companionMarkdown },
      },
    ]),
  );
}

export function serializeBranchStoreData(store: BranchStoreData): SerializedBranchStoreData {
  return {
    branch: store.branch,
    headSha: store.headSha,
    treeSha: store.treeSha,
    fileShas: Array.from(store.fileShas.entries()),
    fileSizes: Array.from(store.fileSizes.entries()),
    entries: serializeEntries(store.entries),
    byCollection: Array.from(store.byCollection.entries(), ([collection, paths]) => [collection, paths.slice()]),
    mediaEntries: serializeEntries(store.mediaEntries),
    reverseEntryReferences: Array.from(store.reverseEntryReferences.entries(), ([target, paths]) => [
      target,
      paths.slice(),
    ]),
    reverseMediaReferences: Array.from(store.reverseMediaReferences.entries(), ([mediaId, paths]) => [
      mediaId,
      paths.slice(),
    ]),
    loadedCompanionPaths: Array.from(store.loadedCompanionPaths),
    populatedAt: store.populatedAt,
    version: store.version,
  };
}

export function deserializeBranchStoreData(
  serialized: SerializedBranchStoreData,
  cacheStatus: AdminCacheStatus = 'fresh',
  cacheError: string | null = null,
): BranchStoreData {
  return {
    branch: serialized.branch,
    headSha: serialized.headSha,
    treeSha: serialized.treeSha,
    fileShas: new Map(serialized.fileShas),
    fileSizes: new Map(serialized.fileSizes),
    entries: deserializeEntries(serialized.entries),
    byCollection: new Map(serialized.byCollection.map(([collection, paths]) => [collection, paths.slice()])),
    mediaEntries: deserializeEntries(serialized.mediaEntries),
    reverseEntryReferences: new Map(
      serialized.reverseEntryReferences.map(([target, paths]) => [target, paths.slice()]),
    ),
    reverseMediaReferences: new Map(
      serialized.reverseMediaReferences.map(([mediaId, paths]) => [mediaId, paths.slice()]),
    ),
    loadedCompanionPaths: new Set(serialized.loadedCompanionPaths),
    populatedAt: serialized.populatedAt,
    version: serialized.version,
    searchIndex: null,
    searchIndexVersion: -1,
    cacheStatus,
    cacheError,
  };
}
