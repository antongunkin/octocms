import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from '../github';
import { getEntryDiff } from './diff';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

const { mockLogCmsServerError } = vi.hoisted(() => ({
  mockLogCmsServerError: vi.fn(),
}));

vi.mock('../../lib/cmsServerLog', () => ({
  logCmsServerError: mockLogCmsServerError,
}));

const { mockGetBranch } = vi.hoisted(() => ({
  mockGetBranch: vi.fn<() => Promise<string>>(),
}));

vi.mock('./git', () => ({
  getBranch: mockGetBranch,
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => true),
  getGitHubFile: vi.fn(),
}));

vi.mock('../../lib/configStore', () => ({
  getConfig: () => ({
    contentFolder: 'cms/content',
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string' },
          body: { label: 'Body', format: 'markdown' },
          hero: { label: 'Hero', format: 'image' },
        },
      },
    },
  }),
}));

// execFile is only used in the dev path. Production tests don't hit it, but we still
// mock the module so any accidental calls fail loudly instead of shelling out.
vi.mock('node:child_process', () => {
  const execFile = () => {
    throw new Error('execFile must not run in production-mode tests');
  };
  return { execFile, default: { execFile } };
});

vi.mock('node:fs/promises', () => {
  const readFile = async () => {
    throw new Error('fs.readFile must not run in production-mode tests');
  };
  return { readFile, default: { readFile } };
});

const makeEntry = (fields: Record<string, unknown>) => JSON.stringify({ sys: { id: 'p1', type: 'post' }, fields });

const makeMedia = (ext: string) =>
  JSON.stringify({ sys: { id: 'u1', type: 'media' }, fields: { title: 'alt', extension: ext } });

beforeEach(() => {
  vi.clearAllMocks();
  mockLogCmsServerError.mockReset();
  vi.mocked(github.isProductionMode).mockReturnValue(true);
  vi.mocked(github.getGitHubFile).mockReset();
  mockGetBranch.mockReset();
});

describe('getEntryDiff', () => {
  it('returns an empty diff when filePath is empty', async () => {
    const result = await getEntryDiff('');
    expect(result).toEqual({
      changed: false,
      activeBranch: '',
      baseBranch: '',
      fields: {},
      companions: {},
      imageUrls: {},
    });
    expect(github.getGitHubFile).not.toHaveBeenCalled();
  });

  it('returns empty diff when active branch equals base branch', async () => {
    mockGetBranch.mockResolvedValue('main');
    const result = await getEntryDiff('cms/content/post/post-p1.json');
    expect(result.changed).toBe(false);
    expect(result.activeBranch).toBe('main');
    expect(result.baseBranch).toBe('main');
    expect(github.getGitHubFile).not.toHaveBeenCalled();
  });

  it('returns empty diff when active branch is missing', async () => {
    mockGetBranch.mockResolvedValue('');
    const result = await getEntryDiff('cms/content/post/post-p1.json');
    expect(result.changed).toBe(false);
    expect(result.activeBranch).toBe('');
    expect(result.baseBranch).toBe('main');
    expect(github.getGitHubFile).not.toHaveBeenCalled();
  });

  it('reports changed=false when the JSON and companion files are identical on both sides', async () => {
    mockGetBranch.mockResolvedValue('cms/edit-1');
    const json = makeEntry({ title: 'Hello', hero: '' });
    vi.mocked(github.getGitHubFile).mockImplementation(async (path: string) => {
      if (path.endsWith('.json') && !path.includes('/media/')) return { content: json, sha: 'x' };
      if (path.endsWith('.md')) return { content: '# body', sha: 'x' };
      return null;
    });

    const result = await getEntryDiff('cms/content/post/post-p1.json');

    expect(result.changed).toBe(false);
    expect(result.activeBranch).toBe('cms/edit-1');
    expect(result.baseBranch).toBe('main');
    expect(result.fields.title).toEqual({ kind: 'unchanged' });
    expect(result.companions.body).toEqual({ before: '# body', after: '# body' });
    expect(result.imageUrls).toEqual({});
  });

  it('marks a field as changed when JSON values differ', async () => {
    mockGetBranch.mockResolvedValue('cms/edit-1');
    vi.mocked(github.getGitHubFile).mockImplementation(async (path: string, ref?: string) => {
      if (path.endsWith('post-p1.json')) {
        return {
          content: ref === 'main' ? makeEntry({ title: 'Old', hero: '' }) : makeEntry({ title: 'New', hero: '' }),
          sha: 'x',
        };
      }
      return null;
    });

    const result = await getEntryDiff('cms/content/post/post-p1.json');

    expect(result.changed).toBe(true);
    expect(result.fields.title).toEqual({ kind: 'changed', before: 'Old', after: 'New' });
  });

  it('marks companion change when only the .md file differs', async () => {
    mockGetBranch.mockResolvedValue('cms/edit-1');
    const json = makeEntry({ title: 'Same' });
    vi.mocked(github.getGitHubFile).mockImplementation(async (path: string, ref?: string) => {
      if (path.endsWith('.json') && !path.includes('/media/')) return { content: json, sha: 'x' };
      if (path.endsWith('.md')) {
        return { content: ref === 'main' ? '# old body' : '# new body', sha: 'x' };
      }
      return null;
    });

    const result = await getEntryDiff('cms/content/post/post-p1.json');

    expect(result.changed).toBe(true);
    expect(result.companions.body).toEqual({ before: '# old body', after: '# new body' });
  });

  it('resolves image UUIDs to /media/<uuid>.<ext> when an image field changes', async () => {
    mockGetBranch.mockResolvedValue('cms/edit-1');
    vi.mocked(github.getGitHubFile).mockImplementation(async (path: string, ref?: string) => {
      if (path.endsWith('post-p1.json')) {
        return {
          content:
            ref === 'main'
              ? makeEntry({ title: 'X', hero: 'old-uuid' })
              : makeEntry({ title: 'X', hero: 'new-uuid' }),
          sha: 'x',
        };
      }
      if (path === 'cms/content/media/media-old-uuid.json') {
        return { content: makeMedia('png'), sha: 'x' };
      }
      if (path === 'cms/content/media/media-new-uuid.json') {
        return { content: makeMedia('jpg'), sha: 'x' };
      }
      return null;
    });

    const result = await getEntryDiff('cms/content/post/post-p1.json');

    expect(result.changed).toBe(true);
    expect(result.fields.hero).toEqual({ kind: 'changed', before: 'old-uuid', after: 'new-uuid' });
    expect(result.imageUrls['old-uuid']).toBe('/media/old-uuid.png');
    expect(result.imageUrls['new-uuid']).toBe('/media/new-uuid.jpg');
  });

  it('treats a missing base-branch file as an added entry (all fields "added")', async () => {
    mockGetBranch.mockResolvedValue('cms/edit-1');
    vi.mocked(github.getGitHubFile).mockImplementation(async (path: string, ref?: string) => {
      if (ref === 'main') return null;
      if (path.endsWith('post-p1.json')) return { content: makeEntry({ title: 'Brand new' }), sha: 'x' };
      return null;
    });

    const result = await getEntryDiff('cms/content/post/post-p1.json');

    expect(result.changed).toBe(true);
    expect(result.fields.title).toEqual({ kind: 'added', after: 'Brand new' });
  });

  it('returns empty diff and logs when getBranch throws', async () => {
    mockGetBranch.mockRejectedValue(new Error('boom'));
    const result = await getEntryDiff('cms/content/post/post-p1.json');
    expect(result).toEqual({
      changed: false,
      activeBranch: '',
      baseBranch: '',
      fields: {},
      companions: {},
      imageUrls: {},
    });
    expect(mockLogCmsServerError).toHaveBeenCalledWith({ operation: 'getEntryDiff', message: 'boom' });
  });
});
