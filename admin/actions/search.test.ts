import fsPromises from 'fs/promises';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as localReader from '../../lib/localReader';
import * as github from '../github';
import * as searchIndex from '../../lib/searchIndex';
import { searchEntries } from './search';

vi.mock('./registerConfig', () => ({}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(() => undefined),
  })),
}));

vi.mock('../../lib/localReader', () => ({
  listLocalFilesRecursive: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: { readFile: vi.fn() },
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
}));

vi.mock('../store/contentStore', () => ({
  getOrBuildSearchIndex: vi.fn(),
}));

vi.mock('../../lib/configStore', () => ({
  getConfig: () => ({
    contentFolder: 'cms/content',
    collections: {},
  }),
}));

vi.mock('../../lib/companionMarkdown', () => ({
  companionMarkdownPathsForEntry: vi.fn(() => ({})),
  companionRichTextPathsForEntry: vi.fn(() => ({})),
}));

vi.mock('../../lib/searchIndex', () => ({
  buildSearchIndex: vi.fn(() => '{"serialized":true}'),
  querySearchIndex: vi.fn(() => [{ id: 'hit-1', title: 'Hello', score: 0.9 }]),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(github.isProductionMode).mockReturnValue(false);
});

// ─── searchEntries ────────────────────────────────────────────────────────────

describe('searchEntries', () => {
  it('returns empty array for blank query without hitting filesystem', async () => {
    const result = await searchEntries('   ');
    expect(result).toEqual([]);
    expect(localReader.listLocalFilesRecursive).not.toHaveBeenCalled();
  });

  it('calls listLocalFilesRecursive with content folder in dev mode', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue([]);
    await searchEntries('hello');
    expect(localReader.listLocalFilesRecursive).toHaveBeenCalledWith('cms/content', '.json');
  });

  it('reads each discovered file and builds the search index in dev mode', async () => {
    const entry = { sys: { id: '1', type: 'post' }, fields: { title: 'Hello world' } };
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue(['cms/content/post/post-1.json']);
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(entry) as any);

    await searchEntries('hello');

    expect(fsPromises.readFile).toHaveBeenCalledWith(path.join(process.cwd(), 'cms/content/post/post-1.json'), {
      encoding: 'utf8',
    });
    expect(searchIndex.buildSearchIndex).toHaveBeenCalledOnce();
    expect(searchIndex.querySearchIndex).toHaveBeenCalledOnce();
  });

  it('returns hits from querySearchIndex in dev mode', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue(['cms/content/post/post-1.json']);
    vi.mocked(fsPromises.readFile).mockResolvedValue(
      JSON.stringify({ sys: { id: '1', type: 'post' }, fields: { title: 'Test' } }) as any,
    );

    const result = await searchEntries('test');

    expect(result).toEqual([{ id: 'hit-1', title: 'Hello', score: 0.9 }]);
  });

  it('skips unreadable files without throwing', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue(['cms/content/post/bad.json']);
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('ENOENT'));

    const result = await searchEntries('anything');

    expect(result).toBeDefined();
    expect(searchIndex.buildSearchIndex).toHaveBeenCalledOnce();
  });
});
