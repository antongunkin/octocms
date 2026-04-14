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

/** Immutable snapshot of all content for a single branch. */
export type BranchStoreData = {
  /** Branch name this data belongs to. */
  branch: string;
  /** Git tree SHA used to populate this snapshot. */
  treeSha: string;
  /** All content entries indexed by normalized file path. */
  entries: Map<string, StoredEntry>;
  /** Collection name → list of entry file paths (for fast listing). */
  byCollection: Map<string, string[]>;
  /** Media JSON entry paths indexed separately for fast media queries. */
  mediaEntries: Map<string, StoredEntry>;
  /** Timestamp (Date.now()) when the store was last populated from GitHub. */
  populatedAt: number;
  /** Monotonically increasing counter, bumped on each write-through mutation. */
  version: number;
  /** Serialized MiniSearch JSON for admin search. null = not yet built. */
  searchIndex: string | null;
  /** Store version when searchIndex was last built. */
  searchIndexVersion: number;
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
