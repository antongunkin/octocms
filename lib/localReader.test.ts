import fsPromises from 'fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { listLocalCollectionFiles, readLocalContentFile, readLocalRawFile } from './localReader';

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
