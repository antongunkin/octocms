import fsPromises from 'fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  listLocalCollectionFiles,
  listLocalFilesRecursive,
  listLocalFilesWithExtensions,
  readLocalContentFile,
  readLocalRawFile,
} from './localReader';

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    readdir: vi.fn(),
  },
}));

vi.mock('path', () => ({
  default: {
    join: (...parts: string[]) => parts.join('/'),
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// readLocalContentFile
// ---------------------------------------------------------------------------

describe('readLocalContentFile', () => {
  it('returns parsed JSON for an existing file', async () => {
    const entry = { sys: { id: '1', type: 'post' }, fields: { title: 'Hello' } };
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(entry) as any);

    const result = await readLocalContentFile('cms/content/post/post-1.json');

    expect(fsPromises.readFile).toHaveBeenCalledWith(`${process.cwd()}/cms/content/post/post-1.json`, {
      encoding: 'utf8',
    });
    expect(result).toEqual(entry);
  });

  it('returns null when the file does not exist (ENOENT)', async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readFile).mockRejectedValue(err);

    expect(await readLocalContentFile('cms/content/post/missing.json')).toBeNull();
  });

  it('returns null when the file contains invalid JSON', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('not json' as any);

    expect(await readLocalContentFile('cms/content/post/bad.json')).toBeNull();
  });

  it('re-throws errors other than ENOENT and SyntaxError', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    vi.mocked(fsPromises.readFile).mockRejectedValue(err);

    await expect(readLocalContentFile('cms/content/post/locked.json')).rejects.toThrow('Permission denied');
  });
});

// ---------------------------------------------------------------------------
// readLocalRawFile
// ---------------------------------------------------------------------------

describe('readLocalRawFile', () => {
  it('returns file content as a string', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue('# Hello world' as any);

    const result = await readLocalRawFile('cms/content/post/post-1.body.md');

    expect(fsPromises.readFile).toHaveBeenCalledWith(`${process.cwd()}/cms/content/post/post-1.body.md`, {
      encoding: 'utf8',
    });
    expect(result).toBe('# Hello world');
  });

  it("returns '' when the file does not exist (ENOENT)", async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readFile).mockRejectedValue(err);

    expect(await readLocalRawFile('cms/content/post/post-missing.body.md')).toBe('');
  });

  it('re-throws errors other than ENOENT', async () => {
    const err: any = new Error('I/O error');
    err.code = 'EIO';
    vi.mocked(fsPromises.readFile).mockRejectedValue(err);

    await expect(readLocalRawFile('cms/content/post/post-1.body.md')).rejects.toThrow('I/O error');
  });
});

// ---------------------------------------------------------------------------
// listLocalCollectionFiles
// ---------------------------------------------------------------------------

const makeDirent = (name: string, isFile = true) => ({ name, isFile: () => isFile });

describe('listLocalCollectionFiles', () => {
  it('returns relative paths for all .json files in the directory', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([makeDirent('post-1.json'), makeDirent('post-2.json')]);

    const result = await listLocalCollectionFiles('cms/content/post');

    expect(fsPromises.readdir).toHaveBeenCalledWith(`${process.cwd()}/cms/content/post`, { withFileTypes: true });
    expect(result).toEqual(['cms/content/post/post-1.json', 'cms/content/post/post-2.json']);
  });

  it('returns [] when the directory does not exist (ENOENT)', async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    expect(await listLocalCollectionFiles('cms/content/nonexistent')).toEqual([]);
  });

  it('filters out non-.json files', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([
      makeDirent('post-1.json'),
      makeDirent('post-1.body.md'),
      makeDirent('.DS_Store'),
    ]);

    const result = await listLocalCollectionFiles('cms/content/post');

    expect(result).toEqual(['cms/content/post/post-1.json']);
  });

  it('filters out sub-directories', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([
      makeDirent('post-1.json', true),
      makeDirent('drafts', false),
    ]);

    const result = await listLocalCollectionFiles('cms/content/post');

    expect(result).toEqual(['cms/content/post/post-1.json']);
  });

  it('returns [] for an empty directory', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([]);

    expect(await listLocalCollectionFiles('cms/content/post')).toEqual([]);
  });

  it('re-throws errors other than ENOENT', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    await expect(listLocalCollectionFiles('cms/content/post')).rejects.toThrow('Permission denied');
  });
});

// ---------------------------------------------------------------------------
// listLocalFilesRecursive
// ---------------------------------------------------------------------------

describe('listLocalFilesRecursive', () => {
  it('returns relative paths for all files matching the extension, recursively', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([
      'post/post-1.json',
      'post/post-2.json',
      'author/author-1.json',
      'post', // directory entry — filtered out by extension
      'author',
    ]);

    const result = await listLocalFilesRecursive('cms/content', '.json');

    expect(fsPromises.readdir).toHaveBeenCalledWith(`${process.cwd()}/cms/content`, { recursive: true });
    expect(result).toEqual([
      'cms/content/author/author-1.json',
      'cms/content/post/post-1.json',
      'cms/content/post/post-2.json',
    ]);
  });

  it('normalizes backslashes to forward slashes', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue(['sub\\file.json']);

    const result = await listLocalFilesRecursive('cms/content', '.json');

    expect(result[0]).toBe('cms/content/sub/file.json');
  });

  it('returns [] when the directory does not exist (ENOENT)', async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    expect(await listLocalFilesRecursive('cms/content', '.json')).toEqual([]);
  });

  it('returns sorted results', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue(['b.json', 'a.json']);

    const result = await listLocalFilesRecursive('cms/content', '.json');

    expect(result).toEqual(['cms/content/a.json', 'cms/content/b.json']);
  });

  it('re-throws errors other than ENOENT', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    await expect(listLocalFilesRecursive('cms/content', '.json')).rejects.toThrow('Permission denied');
  });
});

// ---------------------------------------------------------------------------
// listLocalFilesWithExtensions
// ---------------------------------------------------------------------------

const makeDirentWithExts = (name: string, isFile = true) => ({ name, isFile: () => isFile });

describe('listLocalFilesWithExtensions (non-recursive)', () => {
  it('returns relative paths for files matching any of the given extensions', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([
      makeDirentWithExts('hero.jpg'),
      makeDirentWithExts('photo.png'),
      makeDirentWithExts('readme.txt'),
      makeDirentWithExts('sub', false),
    ]);

    const result = await listLocalFilesWithExtensions('public/media', ['jpg', 'png']);

    expect(fsPromises.readdir).toHaveBeenCalledWith(`${process.cwd()}/public/media`, { withFileTypes: true });
    expect(result).toEqual(['public/media/hero.jpg', 'public/media/photo.png']);
  });

  it('accepts extensions with or without leading dot', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([makeDirentWithExts('img.webp')]);

    const withDot = await listLocalFilesWithExtensions('public/media', ['.webp']);
    const withoutDot = await listLocalFilesWithExtensions('public/media', ['webp']);

    expect(withDot).toEqual(['public/media/img.webp']);
    expect(withoutDot).toEqual(['public/media/img.webp']);
  });

  it('returns [] when directory does not exist (ENOENT)', async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    expect(await listLocalFilesWithExtensions('public/media/missing', ['jpg'])).toEqual([]);
  });

  it('returns sorted results', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([makeDirentWithExts('z.jpg'), makeDirentWithExts('a.png')]);

    const result = await listLocalFilesWithExtensions('public/media', ['jpg', 'png']);

    expect(result).toEqual(['public/media/a.png', 'public/media/z.jpg']);
  });

  it('re-throws errors other than ENOENT', async () => {
    const err: any = new Error('Permission denied');
    err.code = 'EACCES';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    await expect(listLocalFilesWithExtensions('public/media', ['jpg'])).rejects.toThrow('Permission denied');
  });
});

describe('listLocalFilesWithExtensions (recursive)', () => {
  it('recursively lists files matching extensions', async () => {
    vi.mocked(fsPromises.readdir as any).mockResolvedValue([
      'hero.jpg',
      'sub/photo.png',
      'readme.txt',
      'sub', // directory — filtered by extension
    ]);

    const result = await listLocalFilesWithExtensions('public/media', ['jpg', 'png'], true);

    expect(fsPromises.readdir).toHaveBeenCalledWith(`${process.cwd()}/public/media`, { recursive: true });
    expect(result).toEqual(['public/media/hero.jpg', 'public/media/sub/photo.png']);
  });

  it('returns [] when directory does not exist (ENOENT)', async () => {
    const err: any = new Error('ENOENT');
    err.code = 'ENOENT';
    vi.mocked(fsPromises.readdir as any).mockRejectedValue(err);

    expect(await listLocalFilesWithExtensions('public/media', ['jpg'], true)).toEqual([]);
  });
});
