import { cacheLife, cacheTag, revalidateTag, updateTag } from 'next/cache';

import type { ResolvedAdminCacheConfig } from '../../lib/adminCacheConfig';

import { getPublicOctokits } from '../github';
import {
  CONTENT_CHUNK_TARGET_BYTES,
  buildBranchStoreData,
  chunkManifestItems,
  fetchBlobContents,
  fetchBranchHead,
  fetchCommitTree,
  fetchTreeManifest,
  mapBlobContentsToFiles,
  type BlobContent,
  type BranchHead,
  type BranchManifest,
  type BranchManifestItem,
  type CommitTree,
  type FetchedContentFile,
  type TreeManifest,
} from './contentStoreFetch';
import type { BranchStoreData } from './contentStoreTypes';

type BranchHeadCacheInput = {
  owner: string;
  repo: string;
  branch: string;
  branchRevalidateSeconds: number;
  staleIfErrorSeconds: number;
};

type CommitTreeCacheInput = {
  owner: string;
  repo: string;
  headSha: string;
};

type TreeManifestCacheInput = {
  owner: string;
  repo: string;
  treeSha: string;
};

type BlobCacheInput = {
  owner: string;
  repo: string;
  orderedShas: string[];
};

export function adminBranchCacheTag(owner: string, repo: string, branch: string): string {
  return `octocms-admin:${owner}/${repo}:${branch}`.slice(0, 256);
}

async function loadBranchHead(input: BranchHeadCacheInput): Promise<BranchHead | null> {
  const clients = getPublicOctokits();
  for (const octokit of clients) {
    const head = await fetchBranchHead(octokit, input.owner, input.repo, input.branch);
    if (head) return head;
  }
  return null;
}

async function getMemoryCachedBranchHead(input: BranchHeadCacheInput): Promise<BranchHead | null> {
  'use cache';
  cacheTag(adminBranchCacheTag(input.owner, input.repo, input.branch));
  cacheLife({
    revalidate: input.branchRevalidateSeconds,
    expire: Math.max(input.staleIfErrorSeconds, input.branchRevalidateSeconds + 1),
  });
  return loadBranchHead(input);
}

async function getRemoteCachedBranchHead(input: BranchHeadCacheInput): Promise<BranchHead | null> {
  'use cache: remote';
  cacheTag(adminBranchCacheTag(input.owner, input.repo, input.branch));
  cacheLife({
    revalidate: input.branchRevalidateSeconds,
    expire: Math.max(input.staleIfErrorSeconds, input.branchRevalidateSeconds + 1),
  });
  return loadBranchHead(input);
}

async function loadCommitTree(input: CommitTreeCacheInput): Promise<CommitTree | null> {
  for (const octokit of getPublicOctokits()) {
    const commit = await fetchCommitTree(octokit, input.owner, input.repo, input.headSha);
    if (commit) return commit;
  }
  return null;
}

async function getMemoryCachedCommitTree(input: CommitTreeCacheInput): Promise<CommitTree | null> {
  'use cache';
  cacheLife('max');
  return loadCommitTree(input);
}

async function getRemoteCachedCommitTree(input: CommitTreeCacheInput): Promise<CommitTree | null> {
  'use cache: remote';
  cacheLife('max');
  return loadCommitTree(input);
}

async function loadTreeManifest(input: TreeManifestCacheInput): Promise<TreeManifest | null> {
  for (const octokit of getPublicOctokits()) {
    const tree = await fetchTreeManifest(octokit, input.owner, input.repo, input.treeSha, input.treeSha);
    if (tree) return tree;
  }
  return null;
}

async function getMemoryCachedTreeManifest(input: TreeManifestCacheInput): Promise<TreeManifest | null> {
  'use cache';
  cacheLife('max');
  return loadTreeManifest(input);
}

async function getRemoteCachedTreeManifest(input: TreeManifestCacheInput): Promise<TreeManifest | null> {
  'use cache: remote';
  cacheLife('max');
  return loadTreeManifest(input);
}

async function loadBlobChunk(input: BlobCacheInput): Promise<BlobContent[]> {
  for (const octokit of getPublicOctokits()) {
    const blobs = await fetchBlobContents(octokit, input.owner, input.repo, input.orderedShas);
    if (blobs.some((blob) => blob.content !== null) || input.orderedShas.length === 0) return blobs;
  }
  return input.orderedShas.map((sha) => ({ sha, content: null }));
}

async function getMemoryCachedBlobChunk(input: BlobCacheInput): Promise<BlobContent[]> {
  'use cache';
  cacheLife('max');
  return loadBlobChunk(input);
}

async function getRemoteCachedBlobChunk(input: BlobCacheInput): Promise<BlobContent[]> {
  'use cache: remote';
  cacheLife('max');
  return loadBlobChunk(input);
}

function isVercelRuntime(): boolean {
  return process.env.VERCEL === '1';
}

async function loadChunk(input: BlobCacheInput, byteSize: number, useRemoteCache: boolean): Promise<BlobContent[]> {
  if (byteSize > CONTENT_CHUNK_TARGET_BYTES) {
    return loadBlobChunk(input);
  }
  return useRemoteCache ? getRemoteCachedBlobChunk(input) : getMemoryCachedBlobChunk(input);
}

/**
 * Load an indexed snapshot through Next's cache implementation.
 *
 * Self-hosted Node uses the in-memory `use cache` handler. Vercel selects
 * `use cache: remote`, which Vercel provides without an SDK dependency.
 */
export async function fetchNextCachedBranchContent(
  owner: string,
  repo: string,
  branch: string,
  cacheConfig: ResolvedAdminCacheConfig,
): Promise<BranchStoreData | null> {
  const input: BranchHeadCacheInput = {
    owner,
    repo,
    branch,
    branchRevalidateSeconds: cacheConfig.branchRevalidateSeconds,
    staleIfErrorSeconds: cacheConfig.staleIfErrorSeconds,
  };
  const useRemoteCache = isVercelRuntime();
  const head = useRemoteCache ? await getRemoteCachedBranchHead(input) : await getMemoryCachedBranchHead(input);
  if (!head) return null;

  const commitInput: CommitTreeCacheInput = { owner, repo, headSha: head.headSha };
  const commit = useRemoteCache
    ? await getRemoteCachedCommitTree(commitInput)
    : await getMemoryCachedCommitTree(commitInput);
  if (!commit) return null;

  const treeInput: TreeManifestCacheInput = { owner, repo, treeSha: commit.treeSha };
  const tree = useRemoteCache
    ? await getRemoteCachedTreeManifest(treeInput)
    : await getMemoryCachedTreeManifest(treeInput);
  if (!tree) return null;

  const manifest: BranchManifest = {
    branch,
    headSha: head.headSha,
    checkedAt: head.checkedAt,
    treeSha: tree.treeSha,
    items: tree.items,
  };

  const metadataItems = manifest.items.filter((item) => item.path.endsWith('.json'));
  const files = await fetchNextCachedContentFiles(owner, repo, metadataItems);
  return buildBranchStoreData(manifest, files);
}

export async function fetchNextCachedContentFiles(
  owner: string,
  repo: string,
  items: readonly BranchManifestItem[],
): Promise<FetchedContentFile[]> {
  const useRemoteCache = isVercelRuntime();
  const chunks = chunkManifestItems(items);
  const chunkContents = await Promise.all(
    chunks.map((chunk) =>
      loadChunk(
        {
          owner,
          repo,
          orderedShas: Array.from(new Set(chunk.map((item) => item.sha))),
        },
        chunk.reduce((total, item) => total + item.size, 0),
        useRemoteCache,
      ),
    ),
  );
  return chunks.flatMap((chunk, index) => mapBlobContentsToFiles(chunk, chunkContents[index]));
}

/**
 * Invalidate only the branch manifest after a confirmed write. Immutable blob
 * chunks remain reusable because their cache keys contain only repository and SHAs.
 */
export function invalidateNextBranchCache(owner: string, repo: string, branch: string): void {
  const tag = adminBranchCacheTag(owner, repo, branch);
  try {
    updateTag(tag);
  } catch {
    try {
      revalidateTag(tag, { expire: 0 });
    } catch {
      // Unit tests and non-Next callers do not have a request cache context.
    }
  }
}
