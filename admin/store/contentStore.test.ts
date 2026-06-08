import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyMutation,
  clearAllStores,
  getStoredContentFiles,
  getStoredEntryListSnapshot,
  getStoredFile,
  getStoredFileSha,
  getStoredMediaEntries,
  getStoreSnapshot,
  hasStore,
  invalidateBranch,
} from './contentStore';
import type { BranchStoreData, StoredEntry } from './contentStoreTypes';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockConfig = {
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      fields: {
        body: { label: 'Body', format: 'markdown' },
        title: { label: 'Title', format: 'string' },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

vi.mock('octocms/lib/cmsServerLog', () => ({
  logCmsServerError: vi.fn(),
}));

const mockFetchBranchContent = vi.fn<() => Promise<BranchStoreData | null>>();
const mockFetchNextCachedContentFiles = vi.fn();

vi.mock('./contentStoreFetch', () => ({
  fetchBranchContent: (...args: unknown[]) => mockFetchBranchContent(...(args as [])),
  fetchBlobContents: vi.fn(),
  mapBlobContentsToFiles: vi.fn(),
}));

vi.mock('./contentStoreNextCache', () => ({
  fetchNextCachedBranchContent: vi.fn(async () => null),
  fetchNextCachedContentFiles: (...args: unknown[]) => mockFetchNextCachedContentFiles(...args),
  invalidateNextBranchCache: vi.fn(),
}));

vi.mock('../github', () => ({
  assertGitHubConfig: () => ({ owner: 'test', repo: 'repo', branch: 'main' }),
  getAdminReadOctokits: async () => [{}],
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBranchStore(branch: string, overrides?: Partial<BranchStoreData>): BranchStoreData {
  const entry: StoredEntry = {
    path: 'cms/content/post/post-1.json',
    content: { sys: { id: '1', type: 'post' }, fields: { title: 'Hello' } },
    sha: 'abc123',
    companionMarkdown: { body: '# Hello World' },
  };

  const mediaEntry: StoredEntry = {
    path: 'cms/media/media-uuid.json',
    content: {
      sys: { id: 'uuid', type: 'media' },
      fields: { title: 'Photo', extension: 'jpg' },
    },
    sha: 'media-sha',
    companionMarkdown: {},
  };

  return {
    branch,
    headSha: 'commit-sha-000',
    treeSha: 'tree-sha-000',
    fileShas: new Map([
      [entry.path, entry.sha],
      [mediaEntry.path, mediaEntry.sha],
    ]),
    fileSizes: new Map(),
    // After the media-folder split: editorial entries live in `entries`,
    // media entries live in `mediaEntries`. They never share a map.
    entries: new Map([[entry.path, entry]]),
    byCollection: new Map([['post', [entry.path]]]),
    mediaEntries: new Map([[mediaEntry.path, mediaEntry]]),
    reverseEntryReferences: new Map(),
    reverseMediaReferences: new Map(),
    loadedCompanionPaths: new Set(),
    cacheStatus: 'fresh',
    cacheError: null,
    populatedAt: Date.now(),
    version: 0,
    searchIndex: null,
    searchIndexVersion: -1,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

afterEach(() => {
  clearAllStores();
  mockFetchBranchContent.mockReset();
  mockFetchNextCachedContentFiles.mockReset();
  vi.restoreAllMocks();
});

describe('getStoredFile', () => {
  it('returns entry from a warm store', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const result = await getStoredFile('cms/content/post/post-1.json', 'feat');
    expect(result).not.toBeNull();
    expect(result!.path).toBe('cms/content/post/post-1.json');
    expect(result!.sha).toBe('abc123');
    expect(result!.companionMarkdown).toEqual({ body: '# Hello World' });
  });

  it('returns null for a missing file', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const result = await getStoredFile('cms/content/post/post-999.json', 'feat');
    expect(result).toBeNull();
  });

  it('defaults to baseBranch when branch is undefined', async () => {
    const store = makeBranchStore('main');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const result = await getStoredFile('cms/content/post/post-1.json', undefined);
    expect(result).not.toBeNull();
    expect(mockFetchBranchContent).toHaveBeenCalled();
  });

  it('returns null when fetch fails', async () => {
    mockFetchBranchContent.mockResolvedValueOnce(null);
    const result = await getStoredFile('cms/content/post/post-1.json', 'broken');
    expect(result).toBeNull();
  });

  it('loads companion content lazily for entry detail', async () => {
    const store = makeBranchStore('feat');
    const entry = store.entries.get('cms/content/post/post-1.json')!;
    entry.companionMarkdown = {};
    store.fileShas.set('cms/content/post/post-1.body.md', 'body-sha');
    store.fileSizes.set('cms/content/post/post-1.body.md', 12);
    mockFetchBranchContent.mockResolvedValueOnce(store);
    mockFetchNextCachedContentFiles.mockResolvedValueOnce([
      {
        path: 'cms/content/post/post-1.body.md',
        sha: 'body-sha',
        content: '# Lazy body',
      },
    ]);

    const result = await getStoredFile('cms/content/post/post-1.json', 'feat');

    expect(result?.companionMarkdown.body).toBe('# Lazy body');
    expect(mockFetchNextCachedContentFiles).toHaveBeenCalledOnce();
  });
});

describe('getStoredContentFiles', () => {
  it('returns files for a specific collection', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const files = await getStoredContentFiles('post', 'feat');
    expect(files).toEqual(['cms/content/post/post-1.json']);
  });

  it('returns all editorial JSON files when collection is "**" (excludes media)', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const files = await getStoredContentFiles('**', 'feat');
    // Only editorial entries — media is in `mediaEntries`, not `entries`.
    expect(files).toEqual(['cms/content/post/post-1.json']);
    expect(files).not.toContain('cms/media/media-uuid.json');
  });

  it('returns empty array for unknown collection', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const files = await getStoredContentFiles('nonexistent', 'feat');
    expect(files).toEqual([]);
  });

  it('returns null when store is unavailable', async () => {
    mockFetchBranchContent.mockResolvedValueOnce(null);
    const files = await getStoredContentFiles('post', 'broken');
    expect(files).toBeNull();
  });
});

describe('getStoredMediaEntries', () => {
  it('returns media entries map', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const media = await getStoredMediaEntries('feat');
    expect(media).not.toBeNull();
    expect(media!.size).toBe(1);
    expect(media!.has('cms/media/media-uuid.json')).toBe(true);
  });
});

describe('getStoredEntryListSnapshot', () => {
  it('returns entry and media metadata without hydrating companions', async () => {
    const store = makeBranchStore('feat');
    const entry = store.entries.get('cms/content/post/post-1.json')!;
    entry.companionMarkdown = {};
    store.fileShas.set('cms/content/post/post-1.body.md', 'body-sha');
    store.fileSizes.set('cms/content/post/post-1.body.md', 12);
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const snapshot = await getStoredEntryListSnapshot('post', 'feat');

    expect(snapshot?.entries.map((item) => item.path)).toEqual(['cms/content/post/post-1.json']);
    expect(snapshot?.mediaEntries.map((item) => item.path)).toEqual(['cms/media/media-uuid.json']);
    expect(mockFetchNextCachedContentFiles).not.toHaveBeenCalled();
  });
});

describe('getStoredFile (media path)', () => {
  it('finds media entries via getStoredFile', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const result = await getStoredFile('cms/media/media-uuid.json', 'feat');
    expect(result).not.toBeNull();
    expect(result!.sha).toBe('media-sha');
  });
});

describe('getStoredFileSha', () => {
  it('returns SHA for a known file', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const sha = await getStoredFileSha('cms/content/post/post-1.json', 'feat');
    expect(sha).toBe('abc123');
  });

  it('returns null for unknown file', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const sha = await getStoredFileSha('cms/content/post/post-999.json', 'feat');
    expect(sha).toBeNull();
  });
});

describe('applyMutation', () => {
  it('upserts a new entry', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    // Warm the store
    await getStoredFile('cms/content/post/post-1.json', 'feat');

    applyMutation('feat', {
      type: 'upsert',
      path: 'cms/content/post/post-new.json',
      content: { sys: { id: 'new', type: 'post' }, fields: { title: 'New' } },
      sha: 'new-sha',
      companions: { body: '# New' },
    });

    const snapshot = getStoreSnapshot('feat');
    expect(snapshot).toBeDefined();
    expect(snapshot!.entries.has('cms/content/post/post-new.json')).toBe(true);
    expect(snapshot!.byCollection.get('post')).toContain('cms/content/post/post-new.json');
    expect(snapshot!.version).toBe(1);
  });

  it('updates an existing entry', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/content/post/post-1.json', 'feat');

    applyMutation('feat', {
      type: 'upsert',
      path: 'cms/content/post/post-1.json',
      content: { sys: { id: '1', type: 'post' }, fields: { title: 'Updated' } },
      sha: 'new-sha',
    });

    const snapshot = getStoreSnapshot('feat');
    const entry = snapshot!.entries.get('cms/content/post/post-1.json');
    expect((entry!.content as any).fields.title).toBe('Updated');
    // Should not duplicate in collection list
    expect(snapshot!.byCollection.get('post')!.filter((p) => p === 'cms/content/post/post-1.json')).toHaveLength(1);
  });

  it('deletes an entry', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/content/post/post-1.json', 'feat');

    applyMutation('feat', {
      type: 'delete',
      path: 'cms/content/post/post-1.json',
    });

    const snapshot = getStoreSnapshot('feat');
    expect(snapshot!.entries.has('cms/content/post/post-1.json')).toBe(false);
    expect(snapshot!.byCollection.get('post')).not.toContain('cms/content/post/post-1.json');
    expect(snapshot!.version).toBe(1);
  });

  it('deletes a media entry from the media index', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/media/media-uuid.json', 'feat');

    applyMutation('feat', {
      type: 'delete',
      path: 'cms/media/media-uuid.json',
    });

    const snapshot = getStoreSnapshot('feat');
    expect(snapshot!.mediaEntries.has('cms/media/media-uuid.json')).toBe(false);
    // Editorial `entries` map is not touched by media deletes.
    expect(snapshot!.entries.has('cms/content/post/post-1.json')).toBe(true);
  });

  it('is a no-op when the store is not yet populated', () => {
    // Should not throw
    applyMutation('cold-branch', {
      type: 'upsert',
      path: 'cms/content/post/post-1.json',
      content: {},
      sha: 'x',
    });
    expect(hasStore('cold-branch')).toBe(false);
  });
});

describe('invalidateBranch', () => {
  it('removes cached store data', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/content/post/post-1.json', 'feat');

    expect(hasStore('feat')).toBe(true);
    invalidateBranch('feat');
    expect(hasStore('feat')).toBe(false);
  });
});

describe('fetch deduplication', () => {
  it('reuses in-flight promise for the same branch', async () => {
    let resolveCount = 0;
    mockFetchBranchContent.mockImplementation(async () => {
      resolveCount++;
      return makeBranchStore('feat');
    });

    // Fire two reads in parallel for the same branch
    const [a, b] = await Promise.all([
      getStoredFile('cms/content/post/post-1.json', 'feat'),
      getStoredFile('cms/content/post/post-1.json', 'feat'),
    ]);

    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    // Should only have fetched once
    expect(resolveCount).toBe(1);
  });
});

describe('TTL behavior', () => {
  it('serves stale data without re-fetching within STALE_TTL', async () => {
    // First fetch
    const store = makeBranchStore('feat', { populatedAt: Date.now() - 60_000 }); // 60s old (past FRESH, within STALE)
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/content/post/post-1.json', 'feat');

    // Second fetch — should still return stale data (triggers background refresh)
    mockFetchBranchContent.mockResolvedValueOnce(makeBranchStore('feat'));
    const result = await getStoredFile('cms/content/post/post-1.json', 'feat');
    expect(result).not.toBeNull();
  });
});
