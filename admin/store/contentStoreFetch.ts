/**
 * Git-backed snapshot primitives for the CMS admin UI.
 *
 * The manifest and blob-content layers are intentionally serializable so
 * Next.js can cache them remotely without pulling a Vercel SDK into OctoCMS.
 */

import type { Octokit } from 'octokit';

import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { getConfig } from '../../lib/configStore';
import { logCmsServerError } from '../../lib/cmsServerLog';
import { isMediaEntryPath, mediaContentFolder } from '../../lib/mediaPath';

import type { BranchStoreData, StoredEntry } from './contentStoreTypes';

const PARALLEL_BLOB_LIMIT = 20;

/** Leaves headroom for cache serialization overhead below Next/Vercel's 2 MB item limit. */
export const CONTENT_CHUNK_TARGET_BYTES = 900_000;

export type BranchManifestItem = {
  path: string;
  sha: string;
  size: number;
};

export type BranchManifest = {
  branch: string;
  headSha: string | null;
  checkedAt: number;
  treeSha: string;
  items: BranchManifestItem[];
};

export type BranchHead = {
  branch: string;
  headSha: string;
  checkedAt: number;
};

export type CommitTree = {
  headSha: string;
  treeSha: string;
};

export type TreeManifest = {
  treeSha: string;
  items: BranchManifestItem[];
};

export type BlobContent = {
  sha: string;
  content: string | null;
};

export type FetchedContentFile = {
  path: string;
  sha: string;
  content: string | null;
};

type TreeItem = {
  path?: string;
  type?: string;
  sha?: string;
  size?: number;
};

function isCmsContentFile(filePath: string): boolean {
  const config = getConfig();
  if (
    filePath.startsWith(`${config.contentFolder}/`) &&
    (filePath.endsWith('.json') || filePath.endsWith('.md') || filePath.endsWith('.mdx'))
  ) {
    return true;
  }
  return filePath.startsWith(`${mediaContentFolder()}/`) && filePath.endsWith('.json');
}

function collectionFromPath(filePath: string): string | null {
  const config = getConfig();
  if (!filePath.startsWith(`${config.contentFolder}/`)) return null;
  const relative = filePath.slice(config.contentFolder.length + 1);
  const slashIdx = relative.indexOf('/');
  return slashIdx > 0 ? relative.slice(0, slashIdx) : null;
}

function manifestItemPriority(item: BranchManifestItem): number {
  return item.path.endsWith('.json') ? 0 : 1;
}

function orderedManifestItems(items: readonly BranchManifestItem[]): BranchManifestItem[] {
  return [...items].sort((a, b) => manifestItemPriority(a) - manifestItemPriority(b) || a.path.localeCompare(b.path));
}

/** Deterministically partition files into cache-safe chunks using Git-reported blob sizes. */
export function chunkManifestItems(
  items: readonly BranchManifestItem[],
  targetBytes = CONTENT_CHUNK_TARGET_BYTES,
): BranchManifestItem[][] {
  const chunks: BranchManifestItem[][] = [];
  let current: BranchManifestItem[] = [];
  let currentBytes = 0;

  for (const item of orderedManifestItems(items)) {
    const itemBytes = Math.max(0, item.size);
    if (current.length > 0 && currentBytes + itemBytes > targetBytes) {
      chunks.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(item);
    currentBytes += itemBytes;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

async function parallelMap<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function next(): Promise<void> {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(workers);
  return results;
}

export async function fetchBranchHead(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<BranchHead | null> {
  try {
    const { data } = await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
    return { branch, headSha: data.object.sha, checkedAt: Date.now() };
  } catch (error) {
    logCmsServerError({
      operation: 'contentStore.fetchHead',
      branch,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function fetchCommitTree(
  octokit: Octokit,
  owner: string,
  repo: string,
  headSha: string,
): Promise<CommitTree | null> {
  try {
    const { data } = await octokit.rest.git.getCommit({
      owner,
      repo,
      commit_sha: headSha,
    });
    return { headSha, treeSha: data.tree.sha };
  } catch {
    return null;
  }
}

export async function fetchTreeManifest(
  octokit: Octokit,
  owner: string,
  repo: string,
  treeSha: string,
  branchForLogging: string,
): Promise<TreeManifest | null> {
  try {
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: treeSha,
      recursive: '1',
    });

    if (data.truncated) {
      logCmsServerError({
        operation: 'contentStore.fetchTree',
        branch: branchForLogging,
        message: 'Git tree was truncated; the admin snapshot may be incomplete.',
      });
    }

    const items = (data.tree as TreeItem[])
      .filter(
        (item): item is TreeItem & { path: string; sha: string } =>
          item.type === 'blob' &&
          typeof item.path === 'string' &&
          typeof item.sha === 'string' &&
          isCmsContentFile(item.path),
      )
      .map((item) => ({
        path: item.path,
        sha: item.sha,
        size: typeof item.size === 'number' ? item.size : 0,
      }));

    return {
      treeSha: data.sha,
      items: orderedManifestItems(items),
    };
  } catch (error) {
    logCmsServerError({
      operation: 'contentStore.fetchTree',
      branch: branchForLogging,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Direct manifest load. Cached production paths call the three primitives
 * separately so unchanged commit and tree SHAs remain immutable cache hits.
 */
export async function fetchBranchManifest(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<BranchManifest | null> {
  if (!octokit.rest.git.getRef || !octokit.rest.git.getCommit) {
    const tree = await fetchTreeManifest(octokit, owner, repo, branch, branch);
    return tree ? { branch, headSha: null, checkedAt: Date.now(), ...tree } : null;
  }

  const head = await fetchBranchHead(octokit, owner, repo, branch);
  if (!head) return null;
  const commit = await fetchCommitTree(octokit, owner, repo, head.headSha);
  if (!commit) return null;
  const tree = await fetchTreeManifest(octokit, owner, repo, commit.treeSha, branch);
  return tree ? { branch, headSha: head.headSha, checkedAt: head.checkedAt, ...tree } : null;
}

/** Fetch immutable Git blobs with bounded concurrency and SHA deduplication. */
export async function fetchBlobContents(
  octokit: Octokit,
  owner: string,
  repo: string,
  shas: readonly string[],
): Promise<BlobContent[]> {
  const uniqueShas = Array.from(new Set(shas));
  return parallelMap(uniqueShas, PARALLEL_BLOB_LIMIT, async (sha) => {
    try {
      const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
      return {
        sha,
        content: Buffer.from(data.content, 'base64').toString('utf-8'),
      };
    } catch {
      return { sha, content: null };
    }
  });
}

export function mapBlobContentsToFiles(
  items: readonly BranchManifestItem[],
  blobs: readonly BlobContent[],
): FetchedContentFile[] {
  const contentBySha = new Map(blobs.map((blob) => [blob.sha, blob.content]));
  return items.map((item) => ({
    path: item.path,
    sha: item.sha,
    content: contentBySha.get(item.sha) ?? null,
  }));
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
    // A single reference key is intentionally stored as a plain string.
  }
  return [value];
}

function addReverseIndex(index: Map<string, string[]>, key: string, sourcePath: string): void {
  const paths = index.get(key);
  if (!paths) {
    index.set(key, [sourcePath]);
  } else if (!paths.includes(sourcePath)) {
    paths.push(sourcePath);
  }
}

/** Build the parsed/indexed admin snapshot from manifest and fetched file data. */
export function buildBranchStoreData(manifest: BranchManifest, files: readonly FetchedContentFile[]): BranchStoreData {
  const config = getConfig();
  const fileShas = new Map(manifest.items.map((item) => [item.path, item.sha]));
  const fileSizes = new Map(manifest.items.map((item) => [item.path, item.size]));
  const markdownByPath = new Map<string, string>();
  const loadedCompanionPaths = new Set<string>();

  for (const file of files) {
    if (file.content !== null && (file.path.endsWith('.md') || file.path.endsWith('.mdx'))) {
      markdownByPath.set(file.path, file.content);
      loadedCompanionPaths.add(file.path);
    }
  }

  const entries = new Map<string, StoredEntry>();
  const byCollection = new Map<string, string[]>();
  const mediaEntries = new Map<string, StoredEntry>();
  const reverseEntryReferences = new Map<string, string[]>();
  const reverseMediaReferences = new Map<string, string[]>();

  for (const item of files) {
    if (!item.path.endsWith('.json') || item.content === null) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(item.content) as Record<string, unknown>;
    } catch {
      continue;
    }

    const collectionType =
      typeof (parsed as { sys?: { type?: unknown } }).sys?.type === 'string'
        ? (parsed as { sys: { type: string } }).sys.type
        : null;

    const companions: Record<string, string> = {};
    if (collectionType) {
      const markdownPaths = companionMarkdownPathsForEntry(item.path, collectionType, config.collections);
      for (const [fieldName, markdownPath] of Object.entries(markdownPaths)) {
        companions[fieldName] = markdownByPath.get(markdownPath) ?? '';
      }
      const richTextPaths = companionRichTextPathsForEntry(item.path, collectionType, config.collections);
      for (const [fieldName, richTextPath] of Object.entries(richTextPaths)) {
        companions[fieldName] = markdownByPath.get(richTextPath) ?? '';
      }
    }

    const stored: StoredEntry = {
      path: item.path,
      content: parsed,
      sha: item.sha,
      companionMarkdown: companions,
    };

    if (isMediaEntryPath(item.path)) {
      mediaEntries.set(item.path, stored);
      continue;
    }

    entries.set(item.path, stored);
    const collection = collectionFromPath(item.path);
    if (collection) {
      const paths = byCollection.get(collection);
      if (paths) paths.push(item.path);
      else byCollection.set(collection, [item.path]);
    }

    if (!collectionType) continue;
    const collectionConfig = config.collections[collectionType as keyof typeof config.collections];
    const fields = parsed.fields as Record<string, unknown> | undefined;
    if (!collectionConfig || !fields) continue;

    for (const [fieldName, fieldConfig] of Object.entries(collectionConfig.fields)) {
      if (fieldConfig.format === 'reference') {
        for (const key of referenceKeys(fields[fieldName])) {
          addReverseIndex(reverseEntryReferences, key, item.path);
        }
      } else if (fieldConfig.format === 'image') {
        for (const mediaId of referenceKeys(fields[fieldName])) {
          addReverseIndex(reverseMediaReferences, mediaId, item.path);
        }
      }
    }
  }

  return {
    branch: manifest.branch,
    headSha: manifest.headSha,
    treeSha: manifest.treeSha,
    fileShas,
    fileSizes,
    entries,
    byCollection,
    mediaEntries,
    reverseEntryReferences,
    reverseMediaReferences,
    loadedCompanionPaths,
    cacheStatus: 'fresh',
    cacheError: null,
    populatedAt: manifest.checkedAt,
    version: 0,
    searchIndex: null,
    searchIndexVersion: -1,
  };
}

/** Direct, uncached snapshot load used by local Node and cold-start recovery. */
export async function fetchBranchContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<BranchStoreData | null> {
  const manifest = await fetchBranchManifest(octokit, owner, repo, branch);
  if (!manifest) return null;
  if (manifest.items.length === 0) return buildBranchStoreData(manifest, []);

  const blobs = await fetchBlobContents(
    octokit,
    owner,
    repo,
    manifest.items.map((item) => item.sha),
  );
  return buildBranchStoreData(manifest, mapBlobContentsToFiles(manifest.items, blobs));
}
