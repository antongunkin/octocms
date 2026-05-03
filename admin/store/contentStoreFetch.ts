/**
 * Bulk-fetch all CMS content for a branch using the Git Trees API.
 *
 * Replaces N+1 sequential `repos.getContent` calls with:
 *   1 × `git.getTree({ recursive: 1 })`  →  all paths + blob SHAs
 *   N × `git.getBlob(sha)`               →  parallel, chunked (PARALLEL_BLOB_LIMIT)
 *
 * Falls back to the existing per-file REST approach on failure.
 */

import { Octokit } from 'octokit';

import { getConfig } from '../../lib/configStore';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { logCmsServerError } from '../../lib/cmsServerLog';
import { isMediaEntryPath, mediaContentFolder } from '../../lib/mediaPath';

import type { BranchStoreData, StoredEntry } from './contentStoreTypes';

/** Maximum concurrent blob fetches. GitHub allows bursts but we stay conservative. */
const PARALLEL_BLOB_LIMIT = 20;

type TreeItem = {
  path?: string;
  mode?: string;
  type?: string;
  sha?: string;
  size?: number;
};

/** Returns true for CMS-managed files: editorial content under `contentFolder` (`.json`/`.md`/`.mdx`)
 *  or media-entry JSONs under `mediaContentFolder`. */
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

/** Extract collection name from a content path like "cms/content/post/post-123.json".
 *  Returns null for media-entry paths (they have no collection). */
function collectionFromPath(filePath: string): string | null {
  const config = getConfig();
  if (!filePath.startsWith(`${config.contentFolder}/`)) return null;
  const relative = filePath.slice(config.contentFolder.length + 1); // "post/post-123.json"
  const slashIdx = relative.indexOf('/');
  return slashIdx > 0 ? relative.slice(0, slashIdx) : null;
}

/** Fetch blob content from GitHub, returning the decoded UTF-8 string. */
async function fetchBlobContent(octokit: Octokit, owner: string, repo: string, sha: string): Promise<string> {
  const { data } = await octokit.rest.git.getBlob({ owner, repo, file_sha: sha });
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

/** Process fetched items in parallel with a concurrency limit. */
async function parallelMap<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
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

/**
 * Fetch all CMS content for a branch using the Git Trees API.
 *
 * @param octokit  Authenticated Octokit client (session or CMS_GITHUB_TOKEN)
 * @param owner    Repository owner
 * @param repo     Repository name
 * @param branch   Git ref (branch name)
 * @returns Fully populated BranchStoreData or null if the tree fetch fails
 */
export async function fetchBranchContent(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<BranchStoreData | null> {
  const config = getConfig();
  // Step 1: Get the full recursive tree in one API call
  let treeSha: string;
  let treeItems: TreeItem[];

  try {
    const { data } = await octokit.rest.git.getTree({
      owner,
      repo,
      tree_sha: branch,
      recursive: '1',
    });
    treeSha = data.sha;
    treeItems = data.tree;

    if (data.truncated) {
      logCmsServerError({
        operation: 'contentStore.fetchTree',
        branch,
        message: 'Git tree was truncated — repo may have too many files. Store may be incomplete.',
      });
    }
  } catch (error) {
    logCmsServerError({
      operation: 'contentStore.fetchTree',
      branch,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  // Step 2: Filter to CMS content files (json + md under contentFolder)
  const cmsItems = treeItems.filter(
    (item): item is TreeItem & { path: string; sha: string } =>
      item.type === 'blob' &&
      typeof item.path === 'string' &&
      typeof item.sha === 'string' &&
      isCmsContentFile(item.path),
  );

  if (cmsItems.length === 0) {
    return {
      branch,
      treeSha,
      entries: new Map(),
      byCollection: new Map(),
      mediaEntries: new Map(),
      populatedAt: Date.now(),
      version: 0,
      searchIndex: null,
      searchIndexVersion: -1,
    };
  }

  // Build a SHA→path index for deduplication (same blob content shared across files is rare but possible)
  const jsonItems = cmsItems.filter((item) => item.path.endsWith('.json'));
  const mdItems = cmsItems.filter((item) => item.path.endsWith('.md') || item.path.endsWith('.mdx'));

  // Step 3: Fetch all blob contents in parallel chunks
  const jsonContents = await parallelMap(jsonItems, PARALLEL_BLOB_LIMIT, async (item) => {
    try {
      const content = await fetchBlobContent(octokit, owner, repo, item.sha);
      return { path: item.path, sha: item.sha, content };
    } catch {
      return { path: item.path, sha: item.sha, content: null };
    }
  });

  const mdContents = await parallelMap(mdItems, PARALLEL_BLOB_LIMIT, async (item) => {
    try {
      const content = await fetchBlobContent(octokit, owner, repo, item.sha);
      return { path: item.path, content };
    } catch {
      return { path: item.path, content: null };
    }
  });

  // Index markdown contents by path for fast lookup
  const mdByPath = new Map<string, string>();
  for (const md of mdContents) {
    if (md.content !== null) {
      mdByPath.set(md.path, md.content);
    }
  }

  // Step 4: Parse JSON, pair companion markdown, build indexed Maps
  const entries = new Map<string, StoredEntry>();
  const byCollection = new Map<string, string[]>();
  const mediaEntries = new Map<string, StoredEntry>();

  for (const item of jsonContents) {
    if (item.content === null) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(item.content) as Record<string, unknown>;
    } catch {
      continue; // Skip malformed JSON
    }

    const collectionType =
      typeof (parsed as { sys?: { type?: unknown } }).sys?.type === 'string'
        ? (parsed as { sys: { type: string } }).sys.type
        : null;

    // Merge companion markdown and richtext files
    const companions: Record<string, string> = {};
    if (collectionType) {
      const mdPaths = companionMarkdownPathsForEntry(item.path, collectionType, config.collections);
      for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
        companions[fieldName] = mdByPath.get(mdPath) ?? '';
      }
      const rtPaths = companionRichTextPathsForEntry(item.path, collectionType, config.collections);
      for (const [fieldName, rtPath] of Object.entries(rtPaths)) {
        companions[fieldName] = mdByPath.get(rtPath) ?? '';
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

    // Index by collection
    const collection = collectionFromPath(item.path);
    if (collection) {
      const list = byCollection.get(collection);
      if (list) {
        list.push(item.path);
      } else {
        byCollection.set(collection, [item.path]);
      }
    }
  }

  return {
    branch,
    treeSha,
    entries,
    byCollection,
    mediaEntries,
    populatedAt: Date.now(),
    version: 0,
    searchIndex: null,
    searchIndexVersion: -1,
  };
}
