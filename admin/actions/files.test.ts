import fsPromises from 'fs/promises';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as localReader from '../../lib/localReader';
import * as github from '../github';
import * as contentStore from '../store/contentStore';
import * as build from './build';
import { getContentFiles, getFile, getMediaContentFiles, getMediaFiles, newFile, removeFile, saveFile } from './files';
import { getErrorMessage } from './utils';

const { mockCookiesGet } = vi.hoisted(() => ({
  mockCookiesGet: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(github.commitMultipleFilesToGitHub).mockResolvedValue({ sha: 'commit-sha' });
  mockCookiesGet.mockImplementation(() => undefined);
});

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookiesGet(name),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    unlink: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('../../lib/localReader', () => ({
  listLocalFilesRecursive: vi.fn(),
  listLocalFilesWithExtensions: vi.fn(),
  listLocalCollectionFiles: vi.fn(),
}));

vi.mock('../github', () => ({
  GitHubBranchConflictError: class GitHubBranchConflictError extends Error {
    readonly code = 'branch_conflict';
    readonly retryable = true;
  },
  isProductionMode: vi.fn(() => false),
  assertGitHubConfig: vi.fn(() => ({
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
  })),
  getPublicOctokits: vi.fn(() => [undefined, undefined]),
  getGitHubFile: vi.fn(),
  readGitHubFilePublic: vi.fn(),
  commitMultipleFilesToGitHub: vi.fn(async () => ({ sha: 'commit-sha' })),
  saveGitHubFile: vi.fn(),
  deleteGitHubFile: vi.fn(),
  listGitHubFiles: vi.fn(),
  listGitHubFilesRecursive: vi.fn(),
}));

vi.mock('../store/contentStore', () => ({
  applyCommittedMutations: vi.fn(),
  getContentStoreStatus: vi.fn(async () => ({
    status: 'fresh',
    error: null,
    branch: 'main',
    headSha: 'head-sha',
  })),
  getStoredContentFiles: vi.fn(async () => null),
  getStoredFile: vi.fn(async () => null),
  getStoredFileSha: vi.fn(async () => null),
}));

vi.mock('./build', () => ({
  buildJsons: vi.fn().mockResolvedValue({ success: true }),
}));

const mockConfig = {
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['jpg', 'png', 'webp'],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        slug: { label: 'Slug', format: 'slug', required: true },
        price: { label: 'Price', format: 'number', valueType: 'float' },
        publishedAt: { label: 'Published', format: 'datetime', dateOnly: true },
        extras: { label: 'Extras', format: 'json' },
        featuredImage: { label: 'Featured Image', format: 'image' },
      },
    },
    item: {
      label: 'Item',
      hasMany: true,
      fields: {
        enabled: {
          label: 'Enabled',
          format: 'boolean',
          defaultBoolean: true,
          booleanLabels: { true: 'On', false: 'Off' },
        },
        category: {
          label: 'Category',
          format: 'select',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Featured', value: 'featured' },
          ],
          defaultOption: 'general',
        },
        flags: {
          label: 'Flags',
          format: 'select',
          multiple: true,
          options: [
            { label: 'New', value: 'new' },
            { label: 'Sale', value: 'sale' },
          ],
          defaultOptions: ['new'],
        },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns error.message for Error instances', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns String() representation for non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
  });
});

// ─── getContentFiles ──────────────────────────────────────────────────────────

describe('getContentFiles', () => {
  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
  });

  it('returns listLocalCollectionFiles results in dev mode for a specific collection', async () => {
    vi.mocked(localReader.listLocalCollectionFiles).mockResolvedValue(['cms/content/post/123.json']);
    const result = await getContentFiles('post');
    expect(result).toEqual(['cms/content/post/123.json']);
    expect(localReader.listLocalCollectionFiles).toHaveBeenCalledWith('cms/content/post');
  });

  it('uses listLocalFilesRecursive by default (** collection)', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue([
      'cms/content/post/123.json',
      'cms/content/item/456.json',
    ]);
    const result = await getContentFiles();
    expect(localReader.listLocalFilesRecursive).toHaveBeenCalledWith('cms/content', '.json');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when local reader throws', async () => {
    vi.mocked(localReader.listLocalFilesRecursive).mockRejectedValue(new Error('disk error'));
    const result = await getContentFiles();
    expect(result).toEqual([]);
  });

  it('uses listGitHubFilesRecursive in production with default collection', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue(['cms/content/post/123.json']);
    const result = await getContentFiles();
    expect(github.listGitHubFilesRecursive).toHaveBeenCalledWith('cms/content', '.json', undefined);
    expect(result).toEqual(['cms/content/post/123.json']);
  });

  it('passes cms-active-branch cookie to GitHub listing in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'cms/my-edits' } : undefined,
    );
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue(['cms/content/post/123.json']);
    await getContentFiles();
    expect(github.listGitHubFilesRecursive).toHaveBeenCalledWith('cms/content', '.json', 'cms/my-edits');
  });

  it('uses listGitHubFiles in production with a specific collection', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFiles).mockResolvedValue(['cms/content/post/123.json']);
    const result = await getContentFiles('post');
    expect(github.listGitHubFiles).toHaveBeenCalledWith('cms/content/post', '.json', undefined);
    expect(result).toEqual(['cms/content/post/123.json']);
  });

  it('falls back to local reader when GitHub API throws in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFilesRecursive).mockRejectedValue(new Error('API error'));
    vi.mocked(localReader.listLocalFilesRecursive).mockResolvedValue(['cms/content/post/123.json']);
    const result = await getContentFiles();
    expect(result).toEqual(['cms/content/post/123.json']);
  });
});

// ─── getMediaContentFiles ─────────────────────────────────────────────────────

describe('getMediaContentFiles', () => {
  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
  });

  it('returns local collection files in dev mode', async () => {
    vi.mocked(localReader.listLocalCollectionFiles).mockResolvedValue(['cms/media/media-abc.json']);
    const result = await getMediaContentFiles();
    expect(localReader.listLocalCollectionFiles).toHaveBeenCalledWith('cms/media');
    expect(result).toEqual(['cms/media/media-abc.json']);
  });

  it('returns empty array when local reader throws in dev mode', async () => {
    vi.mocked(localReader.listLocalCollectionFiles).mockRejectedValue(new Error('disk error'));
    expect(await getMediaContentFiles()).toEqual([]);
  });

  it('uses listGitHubFiles in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFiles).mockResolvedValue(['cms/media/media-abc.json']);
    const result = await getMediaContentFiles();
    expect(github.listGitHubFiles).toHaveBeenCalledWith('cms/media', '.json', undefined);
    expect(result).toEqual(['cms/media/media-abc.json']);
  });

  it('passes cms-active-branch cookie in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'feature/x' } : undefined,
    );
    vi.mocked(github.listGitHubFiles).mockResolvedValue([]);
    await getMediaContentFiles();
    expect(github.listGitHubFiles).toHaveBeenCalledWith('cms/media', '.json', 'feature/x');
  });

  it('falls back to local reader when GitHub API throws in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFiles).mockRejectedValue(new Error('API error'));
    vi.mocked(localReader.listLocalCollectionFiles).mockResolvedValue(['cms/media/media-abc.json']);
    const result = await getMediaContentFiles();
    expect(result).toEqual(['cms/media/media-abc.json']);
  });
});

// ─── getMediaFiles ────────────────────────────────────────────────────────────

describe('getMediaFiles', () => {
  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
  });

  it('uses listLocalFilesWithExtensions (non-recursive) in dev mode for a named folder', async () => {
    vi.mocked(localReader.listLocalFilesWithExtensions).mockResolvedValue(['public/media/photo.jpg']);
    const result = await getMediaFiles('photos');
    expect(localReader.listLocalFilesWithExtensions).toHaveBeenCalledWith(
      'public/media/photos',
      ['jpg', 'png', 'webp'],
      false,
    );
    expect(result).toEqual(['public/media/photo.jpg']);
  });

  it('uses listLocalFilesWithExtensions (recursive) for the default ** folder', async () => {
    vi.mocked(localReader.listLocalFilesWithExtensions).mockResolvedValue([]);
    await getMediaFiles();
    expect(localReader.listLocalFilesWithExtensions).toHaveBeenCalledWith('public/media', ['jpg', 'png', 'webp'], true);
  });

  it('returns empty array when local reader throws', async () => {
    vi.mocked(localReader.listLocalFilesWithExtensions).mockRejectedValue(new Error('disk error'));
    expect(await getMediaFiles()).toEqual([]);
  });

  it('uses listGitHubFilesRecursive in production and filters by extension', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue([
      'public/media/a.jpg',
      'public/media/b.png',
      'public/media/c.txt',
    ]);
    const result = await getMediaFiles();
    expect(github.listGitHubFilesRecursive).toHaveBeenCalledWith('public/media', undefined, undefined);
    expect(result).toEqual(['public/media/a.jpg', 'public/media/b.png']);
  });

  it('passes cms-active-branch to listGitHubFilesRecursive for media in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'feature/cms' } : undefined,
    );
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue([]);
    await getMediaFiles();
    expect(github.listGitHubFilesRecursive).toHaveBeenCalledWith('public/media', undefined, 'feature/cms');
  });

  it('uses subfolder path in production when folder is specified', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue(['public/media/ipad/hero.webp']);
    const result = await getMediaFiles('ipad');
    expect(github.listGitHubFilesRecursive).toHaveBeenCalledWith('public/media/ipad', undefined, undefined);
    expect(result).toEqual(['public/media/ipad/hero.webp']);
  });

  it('falls back to local reader when GitHub API throws in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.listGitHubFilesRecursive).mockRejectedValue(new Error('API error'));
    vi.mocked(localReader.listLocalFilesWithExtensions).mockResolvedValue(['public/media/photo.jpg']);
    const result = await getMediaFiles();
    expect(result).toEqual(['public/media/photo.jpg']);
  });
});

// ─── getFile ──────────────────────────────────────────────────────────────────

describe('getFile', () => {
  const fileContent = { sys: { id: '1', type: 'post' }, fields: { title: 'Hello' } };

  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
  });

  it('reads and parses a local JSON file in dev mode', async () => {
    vi.mocked(fsPromises.readFile).mockResolvedValue(JSON.stringify(fileContent) as any);
    const result = await getFile('cms/content/post/1.json');
    expect(result).toEqual(fileContent);
    const expectedPath = path.join(process.cwd(), 'cms/content/post/1.json');
    expect(fsPromises.readFile).toHaveBeenCalledWith(expectedPath, { encoding: 'utf8' });
  });

  it('returns GitHub file content in production mode', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.getGitHubFile).mockResolvedValue({ content: JSON.stringify(fileContent) } as any);
    const result = await getFile('cms/content/post/1.json');
    expect(result).toEqual(fileContent);
    expect(github.getGitHubFile).toHaveBeenCalledWith('cms/content/post/1.json', undefined);
  });

  it('uses readGitHubFilePublic when getGitHubFile throws in production (no local FS on serverless)', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.getGitHubFile).mockRejectedValue(new Error('API error'));
    vi.mocked(github.readGitHubFilePublic).mockResolvedValue(JSON.stringify(fileContent, null, 2));
    const result = await getFile('cms/content/post/1.json');
    expect(result).toEqual(fileContent);
    expect(github.readGitHubFilePublic).toHaveBeenCalledWith('cms/content/post/1.json', undefined);
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  it('uses readGitHubFilePublic when getGitHubFile returns null in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.getGitHubFile).mockResolvedValue(null as any);
    vi.mocked(github.readGitHubFilePublic).mockResolvedValue(JSON.stringify(fileContent, null, 2));
    const result = await getFile('cms/content/post/1.json');
    expect(result).toEqual(fileContent);
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  it('returns empty object in production when GitHub and public read both miss', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.getGitHubFile).mockResolvedValue(null as any);
    vi.mocked(github.readGitHubFilePublic).mockResolvedValue(null);
    const result = await getFile('cms/content/post/missing.json');
    expect(result).toEqual({});
    expect(fsPromises.readFile).not.toHaveBeenCalled();
  });

  it('throws "Failed to get file" when both sources fail', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('not found'));
    await expect(getFile('cms/content/post/missing.json')).rejects.toThrow('Failed to get file');
  });
});

// ─── saveFile ─────────────────────────────────────────────────────────────────

describe('saveFile', () => {
  const formData = { sys: { id: 'abc', type: 'post' }, fields: { title: 'Test', slug: 'test' } };

  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'save-feat' } : undefined,
    );
    // Avoid falling through to real local reader when slug checks call `getContentFiles`.
    vi.mocked(github.listGitHubFiles).mockResolvedValue([]);
    vi.mocked(github.listGitHubFilesRecursive).mockResolvedValue([]);
  });

  it('promotes draft to changed on save', async () => {
    const draftForm = {
      sys: { id: 'abc', type: 'post', status: 'draft' as const },
      fields: { title: 'Test', slug: 'test' },
    };
    const out = await saveFile(draftForm, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const written = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string) as {
      sys: { status: string };
    };
    expect(written.sys.status).toBe('changed');
  });

  it('writes JSON to the local filesystem in dev mode', async () => {
    const out = await saveFile(formData, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPath = path.join(process.cwd(), 'cms/content/post/abc.json');
    const expectedPayload = { sys: { id: 'abc', type: 'post' }, fields: { title: 'Test', slug: 'test' } };
    const expectedData = `${JSON.stringify(expectedPayload, null, 2)}\n`;
    expect(fsPromises.writeFile).toHaveBeenCalledWith(expectedPath, expectedData, 'utf8');
    expect(build.buildJsons).toHaveBeenCalledWith('cms/content/post/abc.json');
    expect(github.readGitHubFilePublic).not.toHaveBeenCalled();
  });

  it('commits the entry and branch history atomically in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(github.getGitHubFile).mockResolvedValue({
      sha: 'history-sha',
      content: JSON.stringify({
        'save-feat': {
          title: 'Save feature',
          createdAt: '2026-06-08T00:00:00.000Z',
          entries: [],
        },
      }),
    });

    const out = await saveFile(formData, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });

    const persisted = { sys: { id: 'abc', type: 'post' }, fields: { title: 'Test', slug: 'test' } };
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          kind: 'upsert-text',
          path: 'cms/content/post/abc.json',
          content: `${JSON.stringify(persisted, null, 2)}\n`,
        },
        expect.objectContaining({ kind: 'upsert-text', path: 'cms/branch-history.json' }),
      ]),
      'Update post abc',
      'save-feat',
    );
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledOnce();
    expect(github.readGitHubFilePublic).not.toHaveBeenCalled();
    expect(build.buildJsons).toHaveBeenCalledWith('cms/content/post/abc.json');
  });

  it('runs revalidation after the atomic commit', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);

    await saveFile(formData, 'cms/content/post/abc.json');

    const writeOrder = vi.mocked(github.commitMultipleFilesToGitHub).mock.invocationCallOrder[0];
    const revalidateOrder = vi.mocked(build.buildJsons).mock.invocationCallOrder[0];

    expect(writeOrder).toBeLessThan(revalidateOrder);
  });

  it('falls back to "content" and empty id when sys fields are missing', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);

    const out = await saveFile({}, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });

    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledWith(expect.any(Array), 'Update content ', 'save-feat');
    expect(build.buildJsons).toHaveBeenCalledWith('cms/content/post/abc.json');
  });

  it('returns failure with underlying error message when write fails', async () => {
    vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('disk full'));
    const out = await saveFile(formData, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'Failed to save file: disk full' });
  });

  it('returns build failure when buildJsons fails after write', async () => {
    vi.mocked(build.buildJsons).mockResolvedValue({ success: false, error: 'build failed' } as any);
    const out = await saveFile(formData, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'build failed' });
  });

  it('returns build failure in production when buildJsons fails after GitHub write', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: false, error: 'revalidate failed' } as any);

    const out = await saveFile(formData, 'cms/content/post/abc.json');

    expect(out).toEqual({ success: false, error: 'revalidate failed' });
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalled();
  });

  it('returns retryable conflict errors without mutating the content store', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    const Conflict = github.GitHubBranchConflictError as new (branch: string, detail: string) => Error;
    vi.mocked(github.commitMultipleFilesToGitHub).mockRejectedValue(new Conflict('save-feat', 'moved'));

    const out = await saveFile(formData, 'cms/content/post/abc.json');

    expect(out).toMatchObject({
      success: false,
      code: 'branch_conflict',
      retryable: true,
    });
    expect(contentStore.applyCommittedMutations).not.toHaveBeenCalled();
  });

  it('rejects save in production when cms-active-branch cookie is absent', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation(() => undefined);

    const out = await saveFile(formData, 'cms/content/post/abc.json');

    expect(out).toEqual({
      success: false,
      error: 'Failed to save file: Create or select a branch before editing.',
    });
    expect(github.commitMultipleFilesToGitHub).not.toHaveBeenCalled();
  });

  it('allows save in production when cms-active-branch cookie is present', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'feature/x' } : undefined,
    );
    const out = await saveFile(formData, 'cms/content/post/abc.json');

    expect(out).toEqual({ success: true });
    const persisted = { sys: { id: 'abc', type: 'post' }, fields: { title: 'Test', slug: 'test' } };
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledWith(
      expect.arrayContaining([
        {
          kind: 'upsert-text',
          path: 'cms/content/post/abc.json',
          content: `${JSON.stringify(persisted, null, 2)}\n`,
        },
      ]),
      'Update post abc',
      'feature/x',
    );
  });

  it('returns validation error when required fields are empty', async () => {
    const invalid = { sys: { id: 'abc', type: 'post' }, fields: { title: '   ', slug: 'x' } };
    const out = await saveFile(invalid, 'cms/content/post/abc.json');
    expect(out).toEqual({
      success: false,
      error: 'Title is required',
      fieldErrors: { title: 'Title is required' },
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
    expect(github.saveGitHubFile).not.toHaveBeenCalled();
  });

  it('rejects save when image field references media entry without title', async () => {
    const mediaUuid = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    vi.mocked(fsPromises.readFile).mockImplementation(async (p) => {
      if (String(p).includes(`media-${mediaUuid}.json`)) {
        return JSON.stringify({
          sys: { id: mediaUuid, type: 'media' },
          fields: { extension: 'png', originalName: 'a.png', folder: '/' },
        });
      }
      throw new Error('not found');
    });

    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Post', slug: 'post', featuredImage: mediaUuid },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');

    expect(out).toEqual({
      success: false,
      error: 'Selected image is missing a required Title; fix it in the Media library.',
      fieldErrors: {
        featuredImage: 'Selected image is missing a required Title; fix it in the Media library.',
      },
    });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('allows save when image field references media with title', async () => {
    const mediaUuid = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
    vi.mocked(fsPromises.readFile).mockImplementation(async (p) => {
      if (String(p).includes(`media-${mediaUuid}.json`)) {
        return JSON.stringify({
          sys: { id: mediaUuid, type: 'media' },
          fields: { title: 'Hero', extension: 'png', originalName: 'a.png', folder: '/' },
        });
      }
      throw new Error('not found');
    });

    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Post', slug: 'post-slug', featuredImage: mediaUuid },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');

    expect(out).toEqual({ success: true });
  });

  it('persists number fields as JSON numbers', async () => {
    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', price: '12.5', publishedAt: '' },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPayload = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', price: 12.5, publishedAt: null },
    };
    const expectedData = `${JSON.stringify(expectedPayload, null, 2)}\n`;
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'cms/content/post/abc.json'),
      expectedData,
      'utf8',
    );
  });

  it('persists optional date-only datetime as YYYY-MM-DD', async () => {
    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', price: '0', publishedAt: '2019-07-04' },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPayload = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', price: 0, publishedAt: '2019-07-04' },
    };
    const expectedData = `${JSON.stringify(expectedPayload, null, 2)}\n`;
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'cms/content/post/abc.json'),
      expectedData,
      'utf8',
    );
  });

  it('persists json fields as native JSON values', async () => {
    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: {
        title: 'Widget',
        slug: 'widget',
        price: '1',
        publishedAt: '',
        extras: '{"enabled":true,"tags":["a"]}',
      },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPayload = {
      sys: { id: 'abc', type: 'post' },
      fields: {
        title: 'Widget',
        slug: 'widget',
        price: 1,
        publishedAt: null,
        extras: { enabled: true, tags: ['a'] },
      },
    };
    const expectedData = `${JSON.stringify(expectedPayload, null, 2)}\n`;
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'cms/content/post/abc.json'),
      expectedData,
      'utf8',
    );
  });

  it('returns validation error when json field is invalid', async () => {
    const invalid = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Ok', slug: 'ok', price: '1', publishedAt: '', extras: '{not json' },
    };
    const out = await saveFile(invalid, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'Extras must be valid JSON', fieldErrors: expect.any(Object) });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('accepts json field as a native object (as returned by getFile — publishEntry path)', async () => {
    // Bug: publishEntry calls saveFile with the parsed entry from getFile.
    // JSON fields are JS objects, not strings. String({}) === "[object Object]" fails JSON validation.
    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', extras: { key: 'val', tags: [1, 2] } },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPayload = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', extras: { key: 'val', tags: [1, 2] } },
    };
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'cms/content/post/abc.json'),
      `${JSON.stringify(expectedPayload, null, 2)}\n`,
      'utf8',
    );
  });

  it('accepts json field as a native array (as returned by getFile — publishEntry path)', async () => {
    const input = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', extras: [{ step: 1 }, { step: 2 }] },
    };
    const out = await saveFile(input, 'cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPayload = {
      sys: { id: 'abc', type: 'post' },
      fields: { title: 'Widget', slug: 'widget', extras: [{ step: 1 }, { step: 2 }] },
    };
    expect(fsPromises.writeFile).toHaveBeenCalledWith(
      path.join(process.cwd(), 'cms/content/post/abc.json'),
      `${JSON.stringify(expectedPayload, null, 2)}\n`,
      'utf8',
    );
  });
});

// ─── newFile ──────────────────────────────────────────────────────────────────

describe('newFile', () => {
  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
  });

  it('creates a file with a UUID name and returns its path in dev mode', async () => {
    const result = await newFile('post');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.path).toMatch(/^cms\/content\/post\/post-[0-9a-f-]{36}\.json$/);
      expect(build.buildJsons).toHaveBeenCalledWith(result.path);
    }
    expect(fsPromises.writeFile).toHaveBeenCalledOnce();
  });

  it('writes valid JSON with sys.id and sys.type set', async () => {
    await newFile('post');
    const [, writtenContent] = vi.mocked(fsPromises.writeFile).mock.calls[0];
    const parsed = JSON.parse(writtenContent as string);
    expect(parsed.sys.type).toBe('post');
    expect(parsed.sys.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(parsed.fields).toEqual({});
  });

  it('seeds initial fields from schema defaults for collections that define them', async () => {
    await newFile('item');
    const [, writtenContent] = vi.mocked(fsPromises.writeFile).mock.calls[0];
    const parsed = JSON.parse(writtenContent as string);
    expect(parsed.sys.type).toBe('item');
    expect(parsed.fields).toEqual({
      enabled: 'true',
      category: 'general',
      flags: ['new'],
    });
  });

  it('creates the entry with one atomic commit in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'new-feat' } : undefined,
    );
    const result = await newFile('item');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.path).toMatch(/^cms\/content\/item\/item-[0-9a-f-]{36}\.json$/);
    }
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledOnce();
    expect(github.readGitHubFilePublic).not.toHaveBeenCalled();
    expect(build.buildJsons).toHaveBeenCalledOnce();
    if (result.success) {
      expect(build.buildJsons).toHaveBeenCalledWith(result.path);
    }
  });

  it('runs buildJsons after the atomic create commit in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'new-feat' } : undefined,
    );
    await newFile('post');

    const writeOrder = vi.mocked(github.commitMultipleFilesToGitHub).mock.invocationCallOrder[0];
    const revalidateOrder = vi.mocked(build.buildJsons).mock.invocationCallOrder[0];

    expect(writeOrder).toBeLessThan(revalidateOrder);
  });

  it('returns build failure when buildJsons fails after create in dev', async () => {
    vi.mocked(build.buildJsons).mockResolvedValue({ success: false, error: 'revalidate failed' } as any);
    const result = await newFile('post');
    expect(result).toEqual({ success: false, error: 'revalidate failed' });
  });

  it('returns build failure when buildJsons fails after GitHub create in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'new-feat' } : undefined,
    );
    vi.mocked(build.buildJsons).mockResolvedValue({ success: false, error: 'build down' } as any);

    const result = await newFile('post');

    expect(result).toEqual({ success: false, error: 'build down' });
  });

  it('rejects newFile in production without cms-active-branch cookie', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation(() => undefined);
    const result = await newFile('post');
    expect(result).toEqual({ success: false, error: 'Create or select a branch before editing.' });
    expect(github.commitMultipleFilesToGitHub).not.toHaveBeenCalled();
  });

  it('returns failure on error', async () => {
    vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('disk full'));
    const result = await newFile('post');
    expect(result).toEqual({ success: false, error: 'disk full' });
    expect(build.buildJsons).not.toHaveBeenCalled();
  });

  it('creates the collection directory before writing for first-entry creation in dev', async () => {
    vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined);
    const result = await newFile('post');
    expect(result.success).toBe(true);
    expect(fsPromises.mkdir).toHaveBeenCalledWith(path.join(process.cwd(), 'cms/content/post'), { recursive: true });
    const mkdirOrder = vi.mocked(fsPromises.mkdir).mock.invocationCallOrder[0];
    const writeOrder = vi.mocked(fsPromises.writeFile).mock.invocationCallOrder[0];
    expect(mkdirOrder).toBeLessThan(writeOrder);
  });

  it('succeeds in dev when the collection directory does not yet exist (writeFile would otherwise ENOENT)', async () => {
    let directoryExists = false;
    vi.mocked(fsPromises.mkdir).mockImplementation(async () => {
      directoryExists = true;
      return undefined;
    });
    vi.mocked(fsPromises.writeFile).mockImplementation(async () => {
      if (!directoryExists) {
        const err = new Error("ENOENT: no such file or directory, open 'cms/content/post/...'");
        (err as NodeJS.ErrnoException).code = 'ENOENT';
        throw err;
      }
      return undefined;
    });
    const result = await newFile('post');
    expect(result.success).toBe(true);
  });
});

// ─── removeFile ───────────────────────────────────────────────────────────────

describe('removeFile', () => {
  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
    mockCookiesGet.mockImplementation((name: string) =>
      name === 'cms-active-branch' ? { value: 'del-feat' } : undefined,
    );
  });

  it('unlinks the local file in dev mode', async () => {
    const out = await removeFile('cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    const expectedPath = path.join(process.cwd(), 'cms/content/post/abc.json');
    expect(fsPromises.unlink).toHaveBeenCalledWith(expectedPath);
    expect(build.buildJsons).toHaveBeenCalledWith('cms/content/post/abc.json');
  });

  it('deletes the entry with one atomic commit in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    const out = await removeFile('cms/content/post/abc.json');
    expect(out).toEqual({ success: true });
    expect(github.commitMultipleFilesToGitHub).toHaveBeenCalledWith(
      [{ kind: 'delete', path: 'cms/content/post/abc.json' }],
      'Remove cms/content/post/abc.json',
      'del-feat',
    );
    expect(build.buildJsons).toHaveBeenCalledWith('cms/content/post/abc.json');
  });

  it('returns build failure when buildJsons fails after delete in dev', async () => {
    vi.mocked(build.buildJsons).mockResolvedValue({ success: false, error: 'revalidate failed' } as any);
    const out = await removeFile('cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'revalidate failed' });
  });

  it('rejects removeFile in production without cms-active-branch cookie', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    mockCookiesGet.mockImplementation(() => undefined);
    const out = await removeFile('cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'Create or select a branch before editing.' });
    expect(github.deleteGitHubFile).not.toHaveBeenCalled();
  });

  it('returns failure on error', async () => {
    vi.mocked(fsPromises.unlink).mockRejectedValue(new Error('permission denied'));
    const out = await removeFile('cms/content/post/abc.json');
    expect(out).toEqual({ success: false, error: 'permission denied' });
  });
});
