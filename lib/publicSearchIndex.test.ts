import fsPromises from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as localReader from './localReader';
import * as githubPublic from '../github-public';
import { getConfig } from './configStore';
import { loadPublicSearchIndexJson } from './publicSearchIndex';

vi.mock('./localReader', () => ({
  listLocalFilesRecursive: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn() },
}));

vi.mock('../github-public', () => ({
  isProductionMode: vi.fn(() => false),
  resolveContentBranch: vi.fn(() => Promise.resolve('main')),
  listGitHubFilesRecursive: vi.fn(() => Promise.resolve([])),
  readGitHubFilePublic: vi.fn(() => Promise.resolve(null)),
}));

vi.mock('./configStore', () => ({
  getConfig: vi.fn(() => ({
    contentFolder: 'cms/content',
    collections: {},
    search: {
      publicCollections: { post: true },
    },
  })),
}));

vi.mock('./companionMarkdown', () => ({
  companionMarkdownPathsForEntry: vi.fn(() => ({})),
  companionRichTextPathsForEntry: vi.fn(() => ({})),
}));

vi.mock('./searchIndex', () => ({
  buildSearchIndex: vi.fn(() => '{"built":true}'),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(githubPublic.isProductionMode).mockReturnValue(false);
  vi.mocked(getConfig).mockReturnValue({
    contentFolder: 'cms/content',
    collections: {},
    search: { publicCollections: { post: true } },
  } as any);
});

// ─── loadPublicSearchIndexJson ────────────────────────────────────────────────

describe('loadPublicSearchIndexJson', () => {
  it('returns null when no publicCollections are configured', async () => {
    vi.mocked(getConfig).mockReturnValue({
      contentFolder: 'cms/content',
      collections: {},
      search: { publicCollections: {} },
    } as any);

    const result = await loadPublicSearchIndexJson();
    expect(result).toBeNull();
  });

  it('calls listLocalFilesRecursive in dev mode when no prebuilt index exists', async () => {
    const enoent: any = new Error('ENOENT');
    enoent.code = 'ENOENT';
    vi.mocked(fsPromises.readFile).mockRejectedValue(enoent);
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue([]);

    await loadPublicSearchIndexJson();

    expect(localReader.listLocalFilesRecursive).toHaveBeenCalledWith('cms/content', '.json');
  });

  it('uses prebuilt index from disk in dev mode when available', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('{"prebuilt":true}' as any);

    const result = await loadPublicSearchIndexJson();

    expect(result).toBe('{"prebuilt":true}');
    expect(localReader.listLocalFilesRecursive).not.toHaveBeenCalled();
  });

  it('builds index from discovered files in dev mode', async () => {
    const enoent: any = new Error('ENOENT');
    enoent.code = 'ENOENT';
    vi.mocked(fsPromises.readFile)
      .mockRejectedValueOnce(enoent) // prebuilt not found
      .mockResolvedValue(JSON.stringify({ sys: { id: '1', type: 'post' }, fields: { title: 'Test' } }) as any);
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue(['cms/content/post/post-1.json']);

    const result = await loadPublicSearchIndexJson();

    expect(result).toBe('{"built":true}');
  });

  it('returns null when an error occurs', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('Permission denied'));
    vi.mocked(localReader.listLocalFilesRecursive).mockRejectedValue(new Error('Permission denied'));

    const result = await loadPublicSearchIndexJson();

    expect(result).toBeNull();
  });
});
