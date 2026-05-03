import fsPromises from 'fs/promises';
import path from 'path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from '../github';
import * as filesModule from './files';
import {
  checkMediaReferences,
  deleteMedia,
  getMediaEntries,
  moveMedia,
  updateMediaMetadata,
  uploadMedia,
} from './media';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(github.isProductionMode).mockReturnValue(false);
  vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
  vi.mocked(fsPromises.unlink).mockResolvedValue(undefined);
  vi.mocked(fsPromises.mkdir).mockResolvedValue(undefined as any);
});

vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
    delete: () => {},
  }),
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
  saveGitHubBinaryFile: vi.fn(),
  saveGitHubFile: vi.fn(),
  deleteGitHubFile: vi.fn(),
}));

vi.mock('./files', () => ({
  getContentFiles: vi.fn().mockResolvedValue([]),
  getMediaContentFiles: vi.fn().mockResolvedValue([]),
  getFile: vi.fn(),
  assertFeatureBranchForWritesIfRequired: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('octocms/lib/extractImageMetadata', () => ({
  extractImageMetadata: vi.fn(async () => ({
    width: 100,
    height: 80,
    blurDataURL: 'data:image/jpeg;base64,xx',
  })),
}));

const mockConfig = {
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['jpg', 'jpeg', 'webp', 'png', 'avif', 'gif'],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      fields: {
        title: { format: 'string' },
        featuredImage: { format: 'image' },
        body: { format: 'markdown' },
      },
    },
    item: {
      fields: {
        title: { format: 'string' },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

// ─── Helper ──────────────────────────────────────────────────────────────────

const createMockFile = (name: string, content: string = 'binary-content', type: string = 'image/png'): File => {
  const blob = new Blob([content], { type });
  return new File([blob], name, { type });
};

// ─── getMediaEntries ─────────────────────────────────────────────────────────

describe('getMediaEntries', () => {
  it('returns empty array when no media files exist', async () => {
    vi.mocked(filesModule.getMediaContentFiles).mockResolvedValue([]);
    const result = await getMediaEntries();
    expect(result).toEqual([]);
  });

  it('reads media entries and returns structured MediaFile objects', async () => {
    vi.mocked(filesModule.getMediaContentFiles).mockResolvedValue(['cms/media/media-abc-123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc-123', type: 'media' },
      fields: {
        title: 'Cover',
        originalName: 'photo.png',
        extension: 'png',
        folder: 'blog',
        width: 100,
        height: 80,
        blurDataURL: 'data:image/jpeg;base64,xx',
      },
    });

    const result = await getMediaEntries();

    expect(result).toEqual([
      {
        id: 'abc-123',
        title: 'Cover',
        originalName: 'photo.png',
        extension: 'png',
        folder: 'blog',
        path: 'public/media/abc-123.png',
        publicUrl: '/media/abc-123.png',
        width: 100,
        height: 80,
        hasBlurPlaceholder: true,
      },
    ]);
  });

  it('skips entries that fail to load', async () => {
    vi.mocked(filesModule.getMediaContentFiles).mockResolvedValue(['cms/media/media-bad.json']);
    vi.mocked(filesModule.getFile).mockRejectedValue(new Error('corrupt'));

    const result = await getMediaEntries();
    expect(result).toEqual([]);
  });

  it('returns entries already sorted (deterministic order, no caller sort needed)', async () => {
    // The sort is a stable deterministic ordering — entries without `updatedAt`
    // (the dev-mode fs.stat is mocked away in this test file) keep insertion order.
    vi.mocked(filesModule.getMediaContentFiles).mockResolvedValue([
      'cms/media/media-aaa.json',
      'cms/media/media-bbb.json',
    ]);
    vi.mocked(filesModule.getFile).mockImplementation(async (p) => ({
      sys: { id: p.includes('aaa') ? 'aaa' : 'bbb', type: 'media' },
      fields: { title: 'X', extension: 'png' },
    }));

    const result = await getMediaEntries();
    expect(result).toHaveLength(2);
  });
});

// ─── uploadMedia ─────────────────────────────────────────────────────────────

describe('uploadMedia', () => {
  it('uploads a file and creates a media entry in dev mode', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('folder', '/');
    formData.set('title', 'Photo title');

    const result = await uploadMedia(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(fsPromises.mkdir).toHaveBeenCalledWith(path.join(process.cwd(), 'public/media'), { recursive: true });
    expect(fsPromises.mkdir).toHaveBeenCalledWith(path.join(process.cwd(), 'cms/media'), { recursive: true });
    expect(fsPromises.writeFile).toHaveBeenCalledTimes(2); // physical file + entry JSON
  });

  it('returns media entry UUID', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('hero.jpg', 'data', 'image/jpeg'));
    formData.set('title', 'Hero');

    const result = await uploadMedia(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('stores originalName as the UUID-based filename, not the upload name', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('Long file name.jpg', 'data', 'image/jpeg'));
    formData.set('title', 'Hero');

    const result = await uploadMedia(formData);
    expect(result.success).toBe(true);
    if (!result.success) return;

    const entryWriteCall = vi.mocked(fsPromises.writeFile).mock.calls.find(([p]) => String(p).includes('cms/media/'));
    expect(entryWriteCall).toBeDefined();
    const entry = JSON.parse(entryWriteCall![1] as string);
    // No spaces, no original name — just <uuid>.<ext>.
    expect(entry.fields.originalName).toBe(`${result.id}.jpg`);
    expect(entry.fields.originalName).not.toContain(' ');
  });

  it('forwards generateBlur=0 to extractImageMetadata so blur work is skipped', async () => {
    const { extractImageMetadata } = await import('octocms/lib/extractImageMetadata');
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('title', 'No blur');
    formData.set('generateBlur', '0');

    const result = await uploadMedia(formData);
    expect(result.success).toBe(true);

    expect(extractImageMetadata).toHaveBeenCalledWith(expect.any(Buffer), { generateBlur: false });
  });

  it('defaults generateBlur to true when the flag is absent', async () => {
    const { extractImageMetadata } = await import('octocms/lib/extractImageMetadata');
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('title', 'With blur');

    await uploadMedia(formData);

    expect(extractImageMetadata).toHaveBeenCalledWith(expect.any(Buffer), { generateBlur: true });
  });

  it('uses GitHub API in production mode', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);

    const formData = new FormData();
    formData.set('file', createMockFile('cover.webp', 'data', 'image/webp'));
    formData.set('title', 'Cover image');

    const result = await uploadMedia(formData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    }
    expect(github.saveGitHubBinaryFile).toHaveBeenCalledWith(
      expect.stringMatching(/^public\/media\/[0-9a-f-]+\.webp$/),
      expect.any(Buffer),
      'Upload media cover.webp',
      undefined,
    );
    expect(github.saveGitHubFile).toHaveBeenCalledWith(
      expect.stringMatching(/^cms\/media\/media-[0-9a-f-]+\.json$/),
      expect.any(String),
      expect.stringContaining('Add media entry'),
      undefined,
    );
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('returns failure when no file is provided', async () => {
    const formData = new FormData();
    formData.set('title', 'T');
    const result = await uploadMedia(formData);
    expect(result).toEqual({ success: false, error: 'No file provided' });
  });

  it('returns failure when title is missing', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('folder', '/');
    const result = await uploadMedia(formData);
    expect(result).toEqual({
      success: false,
      error: 'Title is required for every uploaded image',
    });
  });

  it('returns failure when title is whitespace only', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('title', '   ');
    const result = await uploadMedia(formData);
    expect(result).toEqual({
      success: false,
      error: 'Title is required for every uploaded image',
    });
  });

  it('returns failure when file format is not allowed', async () => {
    const formData = new FormData();
    formData.set('title', 'Doc');
    formData.set('file', createMockFile('doc.pdf', 'data', 'application/pdf'));
    const result = await uploadMedia(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('not allowed');
    }
  });

  it('returns failure when file exceeds size limit', async () => {
    const largeContent = 'x'.repeat(11 * 1024 * 1024);
    const formData = new FormData();
    formData.set('title', 'Big');
    formData.set('file', createMockFile('huge.png', largeContent));
    const result = await uploadMedia(formData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('File too large');
    }
  });

  it('returns failure when writing the physical file throws', async () => {
    vi.mocked(fsPromises.writeFile).mockRejectedValueOnce(new Error('enospc'));

    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('title', 'X');

    const result = await uploadMedia(formData);

    expect(result).toEqual({
      success: false,
      error: 'Failed to upload file: enospc',
    });
  });

  it('stores the folder in the media entry', async () => {
    const formData = new FormData();
    formData.set('file', createMockFile('photo.png'));
    formData.set('folder', 'blog');
    formData.set('title', 'Blog photo');

    await uploadMedia(formData);

    const entryWriteCall = vi.mocked(fsPromises.writeFile).mock.calls.find(([p]) => String(p).includes('cms/media/'));
    expect(entryWriteCall).toBeDefined();
    const entry = JSON.parse(entryWriteCall![1] as string);
    expect(entry.fields.folder).toBe('blog');
    // originalName stores the on-disk UUID-based filename (not the user's
    // upload name) so messy names like "Long file name.jpg" stay out of the UI.
    expect(entry.fields.originalName).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(entry.fields.extension).toBe('png');
    expect(entry.fields.title).toBe('Blog photo');
    expect(entry.fields.width).toBe(100);
    expect(entry.fields.height).toBe(80);
    expect(entry.fields.blurDataURL).toBe('data:image/jpeg;base64,xx');
  });
});

// ─── updateMediaMetadata ─────────────────────────────────────────────────────

describe('updateMediaMetadata', () => {
  it('writes trimmed title to the media entry', async () => {
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: {
        title: 'Old',
        extension: 'png',
        originalName: 'a.png',
        folder: '/',
      },
    });

    const out = await updateMediaMetadata('abc', '  New title  ');
    expect(out).toEqual({ success: true });

    const writeCall = vi.mocked(fsPromises.writeFile).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written.fields.title).toBe('New title');
  });

  it('returns failure when title is empty', async () => {
    const out = await updateMediaMetadata('abc', '  ');
    expect(out).toEqual({ success: false, error: 'Title is required' });
  });
});

// ─── deleteMedia ─────────────────────────────────────────────────────────────

describe('deleteMedia', () => {
  it('deletes entry and physical file when not referenced', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([]);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { extension: 'png', originalName: 'photo.png', folder: '/' },
    });

    const out = await deleteMedia('abc');
    expect(out).toEqual({ success: true });

    expect(fsPromises.unlink).toHaveBeenCalledWith(path.join(process.cwd(), 'public/media/abc.png'));
    expect(fsPromises.unlink).toHaveBeenCalledWith(path.join(process.cwd(), 'cms/media/media-abc.json'));
  });

  it('blocks deletion when image is referenced by content entries', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: '123', type: 'post' },
      fields: { title: 'Test', featuredImage: 'abc' },
    });

    const result = await deleteMedia('abc');
    expect(result).toEqual({
      success: false,
      error: 'Cannot delete: image is used in 1 content entry(ies)',
    });
  });

  it('uses GitHub API in production mode', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([]);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { extension: 'jpg', originalName: 'hero.jpg', folder: '/' },
    });

    const out = await deleteMedia('abc');
    expect(out).toEqual({ success: true });

    expect(github.deleteGitHubFile).toHaveBeenCalledWith('public/media/abc.jpg', 'Delete media file abc', undefined);
    expect(github.deleteGitHubFile).toHaveBeenCalledWith(
      'cms/media/media-abc.json',
      'Delete media entry abc',
      undefined,
    );
  });

  it('returns failure when media entry is not found', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([]);
    vi.mocked(filesModule.getFile).mockRejectedValue(new Error('not found'));

    const result = await deleteMedia('missing');
    expect(result).toEqual({ success: false, error: 'Media entry not found' });
  });

  it('returns failure when deleting files throws', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue([]);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { extension: 'png', originalName: 'photo.png', folder: '/' },
    });
    vi.mocked(fsPromises.unlink).mockRejectedValue(new Error('permission denied'));

    const result = await deleteMedia('abc');

    expect(result).toEqual({
      success: false,
      error: 'Failed to delete media: permission denied',
    });
  });
});

// ─── moveMedia ───────────────────────────────────────────────────────────────

describe('moveMedia', () => {
  it('updates the folder field in the media entry', async () => {
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { originalName: 'photo.png', extension: 'png', folder: '/' },
    });

    const out = await moveMedia('abc', 'blog');
    expect(out).toEqual({ success: true });

    const writeCall = vi.mocked(fsPromises.writeFile).mock.calls[0];
    expect(String(writeCall[0])).toContain('cms/media/media-abc.json');
    const written = JSON.parse(writeCall[1] as string);
    expect(written.fields.folder).toBe('blog');
  });

  it('uses GitHub API in production', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(true);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { originalName: 'photo.png', extension: 'png', folder: '/' },
    });

    const out = await moveMedia('abc', 'news');
    expect(out).toEqual({ success: true });

    expect(github.saveGitHubFile).toHaveBeenCalledWith(
      'cms/media/media-abc.json',
      expect.any(String),
      'Move media abc to news',
      undefined,
    );
  });

  it('defaults to root when newFolder is empty', async () => {
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { originalName: 'photo.png', extension: 'png', folder: 'old' },
    });

    const out = await moveMedia('abc', '');
    expect(out).toEqual({ success: true });

    const writeCall = vi.mocked(fsPromises.writeFile).mock.calls[0];
    const written = JSON.parse(writeCall[1] as string);
    expect(written.fields.folder).toBe('/');
  });

  it('returns failure when getFile throws', async () => {
    vi.mocked(filesModule.getFile).mockRejectedValue(new Error('missing entry'));

    const result = await moveMedia('nope', 'blog');

    expect(result).toEqual({
      success: false,
      error: 'Failed to move media: missing entry',
    });
  });

  it('returns failure when saving the entry throws', async () => {
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: 'abc', type: 'media' },
      fields: { originalName: 'photo.png', extension: 'png', folder: '/' },
    });
    vi.mocked(fsPromises.writeFile).mockRejectedValue(new Error('disk full'));

    const result = await moveMedia('abc', 'blog');

    expect(result).toEqual({
      success: false,
      error: 'Failed to move media: disk full',
    });
  });
});

// ─── checkMediaReferences ────────────────────────────────────────────────────

describe('checkMediaReferences', () => {
  it('returns empty array when no content references the media ID', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/123.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: '123', type: 'post' },
      fields: { title: 'Test', featuredImage: 'other-id' },
    });

    const result = await checkMediaReferences('abc');
    expect(result).toEqual([]);
  });

  it('returns file paths that reference the media ID', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/post/p1.json', 'cms/content/post/p2.json']);
    vi.mocked(filesModule.getFile).mockImplementation(async (file) => {
      if (file.includes('p1')) {
        return {
          sys: { id: 'p1', type: 'post' },
          fields: { title: 'A', featuredImage: 'target-id' },
        };
      }
      return {
        sys: { id: 'p2', type: 'post' },
        fields: { title: 'B', featuredImage: 'other-id' },
      };
    });

    const result = await checkMediaReferences('target-id');
    expect(result).toEqual(['cms/content/post/p1.json']);
  });

  it('skips collections without image fields', async () => {
    vi.mocked(filesModule.getContentFiles).mockResolvedValue(['cms/content/item/1.json']);
    vi.mocked(filesModule.getFile).mockResolvedValue({
      sys: { id: '1', type: 'item' },
      fields: { title: 'Widget' },
    });

    const result = await checkMediaReferences('abc');
    expect(result).toEqual([]);
  });
});
