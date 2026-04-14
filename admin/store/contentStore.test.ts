import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  applyMutation,
  clearAllStores,
  getStoredContentFiles,
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
  mediaFolder: 'public/media',
  git: { baseBranch: 'main' },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

vi.mock('octocms/lib/cmsServerLog', () => ({
  logCmsServerError: vi.fn(),
}));

const mockFetchBranchContent = vi.fn<() => Promise<BranchStoreData | null>>();

vi.mock('./contentStoreFetch', () => ({
  fetchBranchContent: (...args: unknown[]) => mockFetchBranchContent(...(args as [])),
}));

vi.mock('../github', () => ({
  assertGitHubConfig: () => ({ owner: 'test', repo: 'repo', branch: 'main' }),
  getPublicOctokits: () => [{}],
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
    path: 'cms/content/media/media-uuid.json',
    content: {
      sys: { id: 'uuid', type: 'media' },
      fields: { title: 'Photo', extension: 'jpg' },
    },
    sha: 'media-sha',
    companionMarkdown: {},
  };

  return {
    branch,
    treeSha: 'tree-sha-000',
    entries: new Map([
      [entry.path, entry],
      [mediaEntry.path, mediaEntry],
    ]),
    byCollection: new Map([
      ['post', [entry.path]],
      ['media', [mediaEntry.path]],
    ]),
    mediaEntries: new Map([[mediaEntry.path, mediaEntry]]),
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
});

describe('getStoredContentFiles', () => {
  it('returns files for a specific collection', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const files = await getStoredContentFiles('post', 'feat');
    expect(files).toEqual(['cms/content/post/post-1.json']);
  });

  it('returns all JSON files when collection is "**"', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);

    const files = await getStoredContentFiles('**', 'feat');
    expect(files).toHaveLength(2);
    expect(files).toContain('cms/content/post/post-1.json');
    expect(files).toContain('cms/content/media/media-uuid.json');
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
    expect(media!.has('cms/content/media/media-uuid.json')).toBe(true);
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

  it('deletes a media entry from both indexes', async () => {
    const store = makeBranchStore('feat');
    mockFetchBranchContent.mockResolvedValueOnce(store);
    await getStoredFile('cms/content/media/media-uuid.json', 'feat');

    applyMutation('feat', {
      type: 'delete',
      path: 'cms/content/media/media-uuid.json',
    });

    const snapshot = getStoreSnapshot('feat');
    expect(snapshot!.entries.has('cms/content/media/media-uuid.json')).toBe(false);
    expect(snapshot!.mediaEntries.has('cms/content/media/media-uuid.json')).toBe(false);
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
