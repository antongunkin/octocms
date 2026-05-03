/**
 * Store I/O for the embeddings index.
 *
 * The store is a single committed JSON file (`cms/__generated__/embeddings.json`)
 * holding one row per content entry: `{ hash, vec }`. `hash` is a sha256 of the
 * embedding text — when an entry's text hasn't changed we skip re-embedding,
 * which keeps `embeddings:gen` fast and idempotent.
 *
 * Used by:
 * - The CLI command `embeddings:gen` for full / incremental rebuilds.
 * - The save/new/remove server actions to keep the store in sync with content.
 * - Phase 2's `searchContent` for cosine retrieval (read-only).
 */

import { createHash } from 'crypto';
import { promises as fsPromises } from 'fs';
import path from 'path';

import type { Config } from '../types';
import { companionFilePathsForEntry } from '../lib/companionMarkdown';
import { entryToEmbeddingText } from './embedText';
import { getDefaultEmbedder, type Embedder, DEFAULT_DIM, DEFAULT_MODEL_ID } from './embedder';
import { decodeFloat32, encodeFloat32 } from './storeFormat';

export const EMBEDDINGS_STORE_PATH = 'cms/__generated__/embeddings.json';

export type EmbeddingsRecord = {
  /** sha256 of the embedding text — used to skip re-embed when content is unchanged. */
  hash: string;
  /** Base64-encoded `Float32Array`. */
  vec: string;
};

export type EmbeddingsStore = {
  model: string;
  dim: number;
  /** Map from content path (e.g. `"cms/content/post/post-abc.json"`) to record. */
  entries: Record<string, EmbeddingsRecord>;
};

/** Hash an embedding text into a stable cache key. */
export function hashEmbeddingText(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/** Construct an empty store with the given embedder's metadata. */
export function emptyStore(embedder?: Embedder): EmbeddingsStore {
  const e = embedder ?? null;
  return {
    model: e?.modelId ?? DEFAULT_MODEL_ID,
    dim: e?.dim ?? DEFAULT_DIM,
    entries: {},
  };
}

function normalizeContentPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/**
 * Read the embeddings store from disk. Returns an empty store when the file
 * doesn't exist yet — first run after enabling the agent.
 *
 * Production reads from the active branch via the GitHub admin helpers;
 * `branch` is forwarded to `getGitHubFile` when provided. Dev / CLI reads
 * straight from the local FS.
 */
export async function loadEmbeddings(branch?: string): Promise<EmbeddingsStore> {
  const raw = await readStoreRaw(branch);
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw) as Partial<EmbeddingsStore>;
    if (!parsed || typeof parsed !== 'object' || !parsed.entries || typeof parsed.entries !== 'object') {
      return emptyStore();
    }
    return {
      model: typeof parsed.model === 'string' ? parsed.model : DEFAULT_MODEL_ID,
      dim: typeof parsed.dim === 'number' ? parsed.dim : DEFAULT_DIM,
      entries: parsed.entries as Record<string, EmbeddingsRecord>,
    };
  } catch {
    return emptyStore();
  }
}

async function readStoreRaw(branch?: string): Promise<string | null> {
  // Try GitHub first when running in production / a Next.js server context;
  // fall back silently to local FS so the CLI works offline.
  try {
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      const { getGitHubFile } = await import('../admin/github');
      const file = await getGitHubFile(EMBEDDINGS_STORE_PATH, branch);
      if (file) return file.content;
    }
  } catch {
    /* fall through to local FS */
  }
  try {
    const abs = path.join(process.cwd(), 'cms', '__generated__', 'embeddings.json');
    return await fsPromises.readFile(abs, { encoding: 'utf8' });
  } catch {
    return null;
  }
}

/** Serialise a store to the canonical on-disk format (JSON, sorted keys, trailing newline). */
export function serializeStore(store: EmbeddingsStore): string {
  const sortedEntries: Record<string, EmbeddingsRecord> = {};
  for (const key of Object.keys(store.entries).sort()) {
    sortedEntries[key] = store.entries[key];
  }
  const ordered: EmbeddingsStore = {
    model: store.model,
    dim: store.dim,
    entries: sortedEntries,
  };
  return JSON.stringify(ordered, null, 2) + '\n';
}

/** Pure helper — return a new store with `path` removed. */
export function removeEntryFromStore(store: EmbeddingsStore, entryPath: string): EmbeddingsStore {
  const norm = normalizeContentPath(entryPath);
  if (!(norm in store.entries)) return store;
  const next: Record<string, EmbeddingsRecord> = { ...store.entries };
  delete next[norm];
  return { ...store, entries: next };
}

/** Pure helper — return a new store with `path` upserted. */
export function upsertEntryInStore(
  store: EmbeddingsStore,
  entryPath: string,
  record: EmbeddingsRecord,
): EmbeddingsStore {
  const norm = normalizeContentPath(entryPath);
  return {
    ...store,
    entries: { ...store.entries, [norm]: record },
  };
}

async function readEntryAndCompanionsLocal(
  filePath: string,
  collections: Config['collections'],
): Promise<{
  entry: { sys?: { type?: string }; fields?: Record<string, unknown> };
  companions: Record<string, string>;
} | null> {
  const abs = path.join(process.cwd(), 'cms', filePath.replace(/^cms[\\/]/, ''));
  let raw: string;
  try {
    raw = await fsPromises.readFile(abs, { encoding: 'utf8' });
  } catch {
    return null;
  }
  let entry: any;
  try {
    entry = JSON.parse(raw);
  } catch {
    return null;
  }
  const collectionType = entry?.sys?.type;
  const companions: Record<string, string> = {};
  if (typeof collectionType === 'string') {
    const paths = companionFilePathsForEntry(filePath, collectionType, collections);
    for (const [field, p] of Object.entries(paths)) {
      try {
        companions[field] = await fsPromises.readFile(path.join(process.cwd(), 'cms', p.replace(/^cms[\\/]/, '')), {
          encoding: 'utf8',
        });
      } catch {
        companions[field] = '';
      }
    }
  }
  return { entry, companions };
}

/**
 * Compute (or look up) the embedding for a single entry on disk.
 *
 * - `store` provides the previous record (if any) so we can skip re-embedding
 *   when the text hash hasn't changed.
 * - `embedder` defaults to the local transformers singleton.
 *
 * Returns `null` when the entry can't be read (deleted between listing and
 * embedding, or unreadable JSON).
 */
export async function embedEntry(
  filePath: string,
  options: {
    collections: Config['collections'];
    store?: EmbeddingsStore;
    embedder?: Embedder;
  },
): Promise<{ path: string; hash: string; vec: Float32Array; skipped: boolean } | null> {
  const { collections, store, embedder = getDefaultEmbedder() } = options;
  const norm = normalizeContentPath(filePath);
  const loaded = await readEntryAndCompanionsLocal(filePath, collections);
  if (!loaded) return null;

  const text = entryToEmbeddingText(loaded.entry, loaded.companions);
  const hash = hashEmbeddingText(text);

  const existing = store?.entries[norm];
  if (existing && existing.hash === hash && store?.dim === embedder.dim) {
    return { path: norm, hash, vec: decodeFloat32(existing.vec), skipped: true };
  }

  const [vec] = await embedder.embed([text]);
  return { path: norm, hash, vec, skipped: false };
}

/**
 * Embed an entry from already-in-memory content. Used by the save/new server
 * actions to avoid an extra disk roundtrip — the entry payload and companion
 * map are right there in `saveFile`'s scope.
 */
export async function embedEntryFromMemory(
  entry: { fields?: Record<string, unknown> },
  companions: Record<string, string>,
  options: {
    store?: EmbeddingsStore;
    embedder?: Embedder;
  } = {},
): Promise<{ hash: string; vec: Float32Array; skipped: boolean; record: EmbeddingsRecord }> {
  const { embedder = getDefaultEmbedder() } = options;
  const text = entryToEmbeddingText(entry, companions);
  const hash = hashEmbeddingText(text);
  const [vec] = await embedder.embed([text]);
  return {
    hash,
    vec,
    skipped: false,
    record: { hash, vec: encodeFloat32(vec) },
  };
}

/**
 * Rebuild the store for `paths` in a single batched embedder call. Reuses
 * existing records when their content hash matches — full rebuilds against
 * unchanged content are no-ops.
 */
export async function embedAll(
  paths: readonly string[],
  options: {
    collections: Config['collections'];
    previous?: EmbeddingsStore;
    embedder?: Embedder;
    /** Optional progress callback — `(done, total)` per entry processed. */
    onProgress?: (done: number, total: number) => void;
  },
): Promise<EmbeddingsStore> {
  const { collections, previous, embedder = getDefaultEmbedder(), onProgress } = options;
  const next = emptyStore(embedder);

  // First pass: compute texts + hashes; mark which need re-embedding.
  type PendingEntry = { path: string; text: string; hash: string };
  const toEmbed: PendingEntry[] = [];
  let processed = 0;

  for (const filePath of paths) {
    const norm = normalizeContentPath(filePath);
    const loaded = await readEntryAndCompanionsLocal(filePath, collections);
    if (!loaded) continue;
    const text = entryToEmbeddingText(loaded.entry, loaded.companions);
    const hash = hashEmbeddingText(text);
    const existing = previous?.entries[norm];
    if (existing && existing.hash === hash && previous?.dim === embedder.dim) {
      next.entries[norm] = existing;
      processed++;
      onProgress?.(processed, paths.length);
      continue;
    }
    toEmbed.push({ path: norm, text, hash });
  }

  // Second pass: batched embedding. Chunk to avoid OOM on giant collections.
  const BATCH = 32;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const chunk = toEmbed.slice(i, i + BATCH);
    const vecs = await embedder.embed(chunk.map((c) => c.text));
    for (let j = 0; j < chunk.length; j++) {
      const { path: p, hash } = chunk[j];
      next.entries[p] = { hash, vec: encodeFloat32(vecs[j]) };
      processed++;
      onProgress?.(processed, paths.length);
    }
  }

  return next;
}
