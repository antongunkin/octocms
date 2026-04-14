import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as filesModule from './files';
import { getEntryBacklinks, getEntryList } from './entries';
import { getEntryTitleField } from './utils';

vi.mock('./files', () => ({
  getContentFiles: vi.fn(),
  getFile: vi.fn(),
}));

const mockConfig = {
  contentFolder: 'cms/content',
  collections: {
    post: {
      fields: {
        title: { format: 'string', entryTitle: true },
        body: { format: 'markdown' },
        authors: { format: 'reference' },
        heroPost: { format: 'reference' },
      },
    },
    homePage: {
      fields: {
        title: { format: 'string', entryTitle: true },
        body: { format: 'markdown' },
      },
    },
    item: {
      fields: {
        name: { format: 'string' },
      },
    },
    tag: {
      fields: {
        label: { format: 'string', entryTitle: true },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

// ─── getEntryTitleField ───────────────────────────────────────────────────────

describe('getEntryTitleField', () => {
  it('returns the field key marked as entryTitle', () => {
    expect(getEntryTitleField('post')).toBe('title');
    expect(getEntryTitleField('homePage')).toBe('title');
  });

  it('returns undefined when the collection has no entryTitle field', () => {
    expect(getEntryTitleField('item')).toBeUndefined();
  });

  it('returns undefined for unknown collection names', () => {
    expect(getEntryTitleField('nonExistent')).toBeUndefined();
  });
});

// ─── getEntryList ─────────────────────────────────────────────────────────────

describe('getEntryList', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns an empty array when there are no content files', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([]);
    const result = await getEntryList();
    expect(result).toEqual([]);
  });

  it('extracts type, id, and path from file paths', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/abc123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: {} });

    const [entry] = await getEntryList();
    expect(entry.type).toBe('post');
    expect(entry.id).toBe('abc123');
    expect(entry.path).toBe('cms/content/post/abc123.json');
  });

  it('uses the entryTitle field as the entry title when available', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/abc123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: { title: 'My Post' } });

    const [entry] = await getEntryList();
    expect(entry.title).toBe('My Post');
  });

  it('uses fields.title for media entries under cms/content/media/', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/media/media-abc.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { title: 'Hero photo', extension: 'png' },
    });

    const [entry] = await getEntryList();
    expect(entry.type).toBe('media');
    expect(entry.id).toBe('abc');
    expect(entry.title).toBe('Hero photo');
  });

  it('defaults status to merged when sys.status is absent', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/abc123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: { title: 'T' } });

    const [entry] = await getEntryList();
    expect(entry.status).toBe('merged');
  });

  it('falls back to the id as title when entryTitle field is empty', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/abc123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: { title: '' } });

    const [entry] = await getEntryList();
    expect(entry.title).toBe('abc123');
  });

  it('falls back to the id as title when the collection has no entryTitle field', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/item/xyz.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: { name: 'Widget' } });

    const [entry] = await getEntryList();
    expect(entry.title).toBe('xyz');
  });

  it('falls back to the id as title when getFile throws', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/abc123.json']);
    vi.mocked(filesModule.getFile).mockRejectedValue(new Error('file not found'));

    const [entry] = await getEntryList();
    expect(entry.title).toBe('abc123');
  });

  it('returns entries sorted alphabetically by title', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([
      'cms/content/post/c.json',
      'cms/content/post/a.json',
      'cms/content/post/b.json',
    ]);
    vi.mocked(filesModule.getFile).mockImplementation(async (file) => ({
      fields: { title: file.includes('/c.') ? 'Zebra' : file.includes('/a.') ? 'Apple' : 'Mango' },
    }));

    const result = await getEntryList();
    expect(result.map((e) => e.title)).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('filters to the given collection when specified', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/1.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({ fields: {} });

    await getEntryList('post');
    expect(filesModule.getContentFiles).toHaveBeenCalledWith('post');
  });

  it('handles multiple entries of different types from a wildcard listing', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([
      'cms/content/post/p1.json',
      'cms/content/homePage/home.json',
    ]);
    vi.mocked(filesModule.getFile).mockImplementation(async (file) => ({
      fields: { title: file.includes('post') ? 'Post Entry' : 'Home Entry' },
    }));

    const result = await getEntryList();
    expect(result).toHaveLength(2);
    const types = result.map((e) => e.type);
    expect(types).toContain('post');
    expect(types).toContain('homePage');
  });
});

// ─── getEntryBacklinks ────────────────────────────────────────────────────────

describe('getEntryBacklinks', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns an empty array when no entry references the target key', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/only.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'only' },
      fields: { title: 'Solo', authors: JSON.stringify(['author-other.json']) },
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toEqual([]);
  });

  it('skips files under cms/content/media/', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/media/uuid-1.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'media', id: 'uuid-1' },
      fields: {},
    });

    const result = await getEntryBacklinks('anything.json');
    expect(result).toEqual([]);
    expect(filesModule.getFile).not.toHaveBeenCalled();
  });

  it('detects backlinks when a reference field stores a JSON array string', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/post-1.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'post-1' },
      fields: { title: 'Hello', authors: JSON.stringify(['author-a1.json', 'author-a2.json']) },
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'post',
      id: 'post-1',
      path: 'cms/content/post/post-1.json',
      title: 'Hello',
    });
  });

  it('detects backlinks when a reference field stores a single key string (cardinality one)', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/post-hero.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'post-hero' },
      fields: { title: 'Hero page', heroPost: 'post-inner.json' },
    });

    const result = await getEntryBacklinks('post-inner.json');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('post-hero');
  });

  it('treats a non-JSON reference string as a single key when JSON.parse fails', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/post-x.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'post-x' },
      fields: { title: 'X', authors: 'author-a1.json' },
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toHaveLength(1);
  });

  it('detects backlinks when the stored reference value is a native string array', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/post-arr.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'post-arr' },
      fields: { title: 'Arr', authors: ['author-a1.json'] },
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toHaveLength(1);
  });

  it('skips files without a collection schema or reference fields', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([
      'cms/content/post/p1.json',
      'cms/content/item/i1.json',
      'cms/content/tag/t1.json',
    ]);
    vi.mocked(filesModule.getFile).mockImplementation(async (path: string) => {
      if (path.includes('/item/')) {
        return { sys: { type: 'item', id: 'i1' }, fields: { name: 'Widget' } };
      }
      if (path.includes('/tag/')) {
        return { sys: { type: 'tag', id: 't1' }, fields: { label: 'T' } };
      }
      return {
        sys: { type: 'post', id: 'p1' },
        fields: { title: 'P', authors: JSON.stringify(['author-a1.json']) },
      };
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('post');
  });

  it('skips files when getFile throws', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([
      'cms/content/post/bad.json',
      'cms/content/post/good.json',
    ]);
    vi.mocked(filesModule.getFile).mockImplementation(async (path: string) => {
      if (path.includes('/bad.')) {
        throw new Error('read failed');
      }
      return {
        sys: { type: 'post', id: 'good' },
        fields: { title: 'OK', authors: JSON.stringify(['author-a1.json']) },
      };
    });

    const result = await getEntryBacklinks('author-a1.json');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('good');
  });

  it('falls back to id as title when entryTitle field is missing', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/post-1.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { type: 'post', id: 'post-1' },
      fields: { authors: JSON.stringify(['author-a1.json']) },
    });

    const [link] = await getEntryBacklinks('author-a1.json');
    expect(link.title).toBe('post-1');
  });
});
