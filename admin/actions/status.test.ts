import fsPromises from 'fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from '../github';
import * as build from './build';
import { archiveEntry, publishEntry, restoreEntry } from './status';

const { mockCookiesGet } = vi.hoisted(() => ({
  mockCookiesGet: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCookiesGet.mockImplementation((name: string) =>
    name === 'cms-active-branch' ? { value: 'feature/x' } : undefined,
  );
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
  },
}));

vi.mock('glob', () => ({ glob: vi.fn() }));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
  assertGitHubConfig: vi.fn(() => ({ owner: 'o', repo: 'r', branch: 'main' })),
  getPublicOctokits: vi.fn(() => [undefined, undefined]),
  getGitHubFile: vi.fn(),
  readGitHubFilePublic: vi.fn(),
  saveGitHubFile: vi.fn(),
  deleteGitHubFile: vi.fn(),
  listGitHubFiles: vi.fn(),
  listGitHubFilesRecursive: vi.fn(),
}));

vi.mock('./build', () => ({
  buildJsons: vi.fn().mockResolvedValue({ success: true }),
}));

const mockConfig = {
  contentFolder: 'cms/content',
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
        steps: { label: 'Steps', format: 'json' },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

/** Mock readFile to return the entry JSON for the given file path, and throw for anything else. */
function mockEntryFile(fileName: string, entry: object) {
  vi.mocked(fsPromises.readFile).mockImplementation(async (p) => {
    if (String(p).endsWith(fileName)) return JSON.stringify(entry) as any;
    throw new Error('not found');
  });
}

// ─── publishEntry ──────────────────────────────────────────────────────────────

describe('publishEntry', () => {
  const FILE = 'post-abc.json';
  const PATH = `cms/content/post/${FILE}`;

  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
  });

  it('sets sys.status to "published" and saves', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'changed' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await publishEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('published');
  });

  it('publishes a draft entry', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'draft' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await publishEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('published');
  });

  it('succeeds when json fields are native objects — the publish bug fix', async () => {
    // publishEntry reads the entry via getFile (returns parsed JS), then passes it to saveFile.
    // Before the fix, String([{...}]) = "[object Object]" caused "invalid JSON" validation failure.
    const entry = {
      sys: { id: 'abc', type: 'post', status: 'changed' },
      fields: {
        title: 'Page',
        slug: 'page',
        steps: [
          { title: 'Define schema', description: 'A TypeScript config file.' },
          { title: 'Edit in UI', description: 'Polished editor at /cms.' },
        ],
      },
    };
    mockEntryFile(FILE, entry);

    const out = await publishEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('published');
    expect(saved.fields.steps).toEqual(entry.fields.steps);
  });

  it('returns error for archived entries', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'archived' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await publishEntry(PATH);

    expect(out).toEqual({ success: false, error: 'Cannot publish an archived entry. Restore it first.' });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('returns error when entry file does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('not found'));

    const out = await publishEntry(PATH);

    expect(out.success).toBe(false);
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });
});

// ─── archiveEntry ──────────────────────────────────────────────────────────────

describe('archiveEntry', () => {
  const FILE = 'post-abc.json';
  const PATH = `cms/content/post/${FILE}`;

  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
  });

  it('sets sys.status to "archived"', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'published' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await archiveEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('archived');
  });

  it('succeeds when json fields are native objects — same code path as publish', async () => {
    const entry = {
      sys: { id: 'abc', type: 'post', status: 'published' },
      fields: { title: 'Page', slug: 'page', steps: [{ title: 'Step 1' }, { title: 'Step 2' }] },
    };
    mockEntryFile(FILE, entry);

    const out = await archiveEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('archived');
    expect(saved.fields.steps).toEqual(entry.fields.steps);
  });

  it('returns error when entry file does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('not found'));

    const out = await archiveEntry(PATH);

    expect(out.success).toBe(false);
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });
});

// ─── restoreEntry ──────────────────────────────────────────────────────────────

describe('restoreEntry', () => {
  const FILE = 'post-abc.json';
  const PATH = `cms/content/post/${FILE}`;

  beforeEach(() => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    vi.mocked(fsPromises.writeFile).mockResolvedValue(undefined);
    vi.mocked(build.buildJsons).mockResolvedValue({ success: true } as any);
  });

  it('sets sys.status to "draft" when restoring an archived entry', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'archived' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await restoreEntry(PATH);

    expect(out).toEqual({ success: true });
    const saved = JSON.parse(vi.mocked(fsPromises.writeFile).mock.calls[0][1] as string);
    expect(saved.sys.status).toBe('draft');
  });

  it('returns error when entry is not archived', async () => {
    const entry = { sys: { id: 'abc', type: 'post', status: 'published' }, fields: { title: 'Hi', slug: 'hi' } };
    mockEntryFile(FILE, entry);

    const out = await restoreEntry(PATH);

    expect(out).toEqual({ success: false, error: 'Only archived entries can be restored.' });
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });

  it('returns error when entry file does not exist', async () => {
    vi.mocked(fsPromises.readFile).mockRejectedValue(new Error('not found'));

    const out = await restoreEntry(PATH);

    expect(out.success).toBe(false);
    expect(fsPromises.writeFile).not.toHaveBeenCalled();
  });
});
