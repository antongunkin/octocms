/**
 * Phase 2 — Retrieval.
 *
 * `searchContent(query, options)` runs cosine similarity over the committed
 * embeddings store and returns ranked content hits. The agent calls this from
 * its `searchContent` tool; the same function is also handy for one-off
 * scripts or other admin UI that needs retrieval.
 *
 * Reads only — never mutates content. Loads the same on-disk store the
 * embedding pipeline writes (`cms/__generated__/embeddings.json`), so search
 * results follow whichever branch the caller targets.
 *
 * The store is cached in module scope for ~30 seconds. That's plenty for the
 * back-and-forth of a single chat turn (multiple tool calls share one load)
 * while still picking up freshly committed embeddings without a process
 * restart.
 */

import { promises as fsPromises } from 'fs';
import path from 'path';

import type { Config } from '../admin/types';
import { getConfig } from '../lib/configStore';
import { buildEntryExcerpt, collectionFromPath, resolveEntryId, resolveEntryTitle } from '../lib/resolveEntryTitle';

import { getDefaultEmbedder, type Embedder } from './embedder';
import { loadEmbeddings, type EmbeddingsStore } from './embeddings';
import { cosineSimilarity, decodeFloat32 } from './storeFormat';

export type SearchHit = {
  /** Entry id — filename stem for non-media, `sys.id` for media. */
  id: string;
  /** Repo-relative path, e.g. `cms/content/post/post-abc.json`. */
  path: string;
  /** Collection name (= `sys.type`). */
  collection: string;
  /** Cosine similarity in `[-1, 1]`. Higher = better match. */
  score: number;
  /** Human-readable title resolved from the schema's `entryTitle` field. */
  title: string;
  /** Short text excerpt (≤ 200 chars by default) — empty when nothing useful is available. */
  excerpt: string;
};

export type SearchOptions = {
  /** Top-K hits to return. Defaults to 10. */
  k?: number;
  /** Restrict results to a single collection (`sys.type`). */
  collection?: string;
  /** Branch override forwarded to `loadEmbeddings` and the entry reader. */
  branch?: string;
  /** Override the embedder (test seam). Defaults to the local transformers singleton. */
  embedder?: Embedder;
  /** Bypass the in-process store cache. Defaults to false. */
  noCache?: boolean;
  /** Excerpt max length. Defaults to 200. */
  excerptLength?: number;
};

type CacheEntry = { store: EmbeddingsStore; expiresAt: number; key: string };

const STORE_CACHE_TTL_MS = 30_000;
let cached: CacheEntry | null = null;

async function getStore(branch: string | undefined, noCache: boolean): Promise<EmbeddingsStore> {
  const key = branch ?? '';
  const now = Date.now();
  if (!noCache && cached && cached.key === key && cached.expiresAt > now) {
    return cached.store;
  }
  const store = await loadEmbeddings(branch);
  cached = { store, expiresAt: now + STORE_CACHE_TTL_MS, key };
  return store;
}

/** Test seam — drop the cached store so the next call reloads from disk. */
export function clearSearchCache(): void {
  cached = null;
}

async function readEntryPayload(filePath: string, branch: string | undefined): Promise<unknown | null> {
  // Match `loadEmbeddings`'s strategy: try GitHub in production, fall back to
  // the local filesystem. We deliberately don't merge companion `.md` content —
  // titles and excerpts come from `entry.fields` only, which keeps each search
  // hit cheap (no extra companion fetch per result).
  try {
    if (process.env.NODE_ENV === 'production') {
      const { getGitHubFile } = await import('../admin/github');
      const file = await getGitHubFile(filePath, branch);
      if (file) {
        try {
          return JSON.parse(file.content);
        } catch {
          return null;
        }
      }
    }
  } catch {
    /* fall through to FS */
  }
  try {
    const abs = path.join(process.cwd(), 'cms', filePath.replace(/^cms[\\/]/, ''));
    const raw = await fsPromises.readFile(abs, { encoding: 'utf8' });
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Run cosine retrieval over the embeddings store.
 *
 * Scoring is brute-force (one dot product per stored vector). At the design
 * scale of ~5,000 entries × 384 dims this finishes in ~10 ms on a warm process —
 * the dominant cost is embedding the query, which is ~3–10 s on cold start
 * and < 100 ms warm.
 */
export async function searchContent(query: string, options: SearchOptions = {}): Promise<SearchHit[]> {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return [];

  const k = Math.max(1, options.k ?? 10);
  const embedder = options.embedder ?? getDefaultEmbedder();
  const config: Config = getConfig();

  const store = await getStore(options.branch, options.noCache ?? false);
  const paths = Object.keys(store.entries);
  if (paths.length === 0) return [];

  const [queryVec] = await embedder.embed([trimmed]);

  // Score every entry, optionally pre-filtered by collection. We score before
  // resolving titles/excerpts so the per-hit disk reads only run for the top K.
  type Scored = { path: string; score: number };
  const scored: Scored[] = [];
  for (const p of paths) {
    if (options.collection) {
      const c = collectionFromPath(config, p);
      if (c !== options.collection) continue;
    }
    const record = store.entries[p];
    let vec: Float32Array;
    try {
      vec = decodeFloat32(record.vec);
    } catch {
      continue;
    }
    if (vec.length !== queryVec.length) continue;
    const score = cosineSimilarity(queryVec, vec);
    scored.push({ path: p, score });
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, k);

  const excerptLength = options.excerptLength ?? 200;
  const hits: SearchHit[] = [];
  for (const { path: p, score } of top) {
    const payload = (await readEntryPayload(p, options.branch)) as {
      sys?: { id?: unknown; type?: unknown };
      fields?: Record<string, unknown>;
    } | null;
    const collection = collectionFromPath(config, p);
    hits.push({
      id: resolveEntryId(config, p, payload ?? undefined),
      path: p,
      collection,
      score,
      title: resolveEntryTitle(config, p, payload ?? undefined),
      excerpt: buildEntryExcerpt(config, p, payload ?? undefined, excerptLength),
    });
  }

  return hits;
}
