import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from '../github';
import * as files from './files';
import { createBranch, publishBranch } from './git';

const { mockCookieSet } = vi.hoisted(() => ({
  mockCookieSet: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: vi.fn(),
    set: mockCookieSet,
    delete: vi.fn(),
  })),
}));

vi.mock('octocms/lib/cmsServerLog', () => ({
  logCmsServerError: vi.fn(),
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
  saveGitHubFile: vi.fn(),
  getPublishedPointerRef: vi.fn(),
  markPRReadyForReview: vi.fn(),
  createGitHubBranch: vi.fn(),
  createGitHubCMSPullRequest: vi.fn(),
  getGitHubFile: vi.fn(),
}));

vi.mock('./files', () => ({
  waitForPublicReadConsistency: vi.fn(),
}));

vi.mock('./build', () => ({
  buildJsons: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../../lib/configStore', () => ({
  getConfig: () => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {},
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieSet.mockReset();
  vi.mocked(github.createGitHubBranch).mockResolvedValue(undefined as any);
  vi.mocked(github.getGitHubFile).mockResolvedValue(null);
  vi.mocked(github.saveGitHubFile).mockResolvedValue(undefined as any);
  vi.mocked(github.createGitHubCMSPullRequest).mockResolvedValue({
    url: 'https://example.com/pr/1',
    number: 1,
  });
});

describe('publishBranch', () => {
  it('writes published.json to base branch when pointer ref is unset', async () => {
    vi.mocked(github.getPublishedPointerRef).mockReturnValue(undefined);
    vi.mocked(github.saveGitHubFile).mockResolvedValue(undefined as any);
    vi.mocked(files.waitForPublicReadConsistency).mockResolvedValue(undefined);

    await publishBranch('feature-a');

    expect(github.saveGitHubFile).toHaveBeenCalledWith(
      'cms/published.json',
      `${JSON.stringify({ branch: 'feature-a' }, null, 2)}\n`,
      'Publish branch feature-a',
      'main',
    );
    expect(files.waitForPublicReadConsistency).toHaveBeenCalledWith(
      'cms/published.json',
      `${JSON.stringify({ branch: 'feature-a' }, null, 2)}\n`,
      'main',
    );
  });

  it('writes published.json to pointer branch when getPublishedPointerRef returns a branch', async () => {
    vi.mocked(github.getPublishedPointerRef).mockReturnValue('cms/publish-pointer');
    vi.mocked(github.saveGitHubFile).mockResolvedValue(undefined as any);
    vi.mocked(files.waitForPublicReadConsistency).mockResolvedValue(undefined);

    await publishBranch('feature-b');

    expect(github.saveGitHubFile).toHaveBeenCalledWith(
      'cms/published.json',
      `${JSON.stringify({ branch: 'feature-b' }, null, 2)}\n`,
      'Publish branch feature-b',
      'cms/publish-pointer',
    );
    expect(files.waitForPublicReadConsistency).toHaveBeenCalledWith(
      'cms/published.json',
      `${JSON.stringify({ branch: 'feature-b' }, null, 2)}\n`,
      'cms/publish-pointer',
    );
  });
});

describe('createBranch', () => {
  it('commits branch history, opens PR, and sets active branch cookie', async () => {
    const result = await createBranch({
      branchName: 'cms/edit-test',
      title: 'My workspace',
      description: 'Hello',
    });

    expect(result).toEqual({
      success: true,
      prUrl: 'https://example.com/pr/1',
    });
    expect(github.createGitHubBranch).toHaveBeenCalledWith('cms/edit-test');
    expect(github.getGitHubFile).toHaveBeenCalledWith('cms/branch-history.json', expect.any(String));
    expect(github.saveGitHubFile).toHaveBeenCalledWith(
      'cms/branch-history.json',
      expect.any(String),
      'CMS: add branch workspace metadata',
      'cms/edit-test',
    );

    const [, content] = vi.mocked(github.saveGitHubFile).mock.calls[0];
    const parsed = JSON.parse(content as string) as Record<string, { title: string; description?: string }>;
    expect(parsed['cms/edit-test'].title).toBe('My workspace');
    expect(parsed['cms/edit-test'].description).toBe('Hello');

    expect(github.createGitHubCMSPullRequest).toHaveBeenCalledWith(
      'cms/edit-test',
      'My workspace',
      expect.stringContaining('cms/edit-test'),
      expect.any(String),
    );

    expect(mockCookieSet).toHaveBeenCalledWith('cms-active-branch', 'cms/edit-test', { path: '/' });
  });

  it('sets cookie and returns warning when PR creation fails after metadata commit', async () => {
    vi.mocked(github.createGitHubCMSPullRequest).mockRejectedValue(new Error('GitHub: nope'));

    const result = await createBranch({
      branchName: 'cms/b',
      title: 'T',
    });

    expect(result).toEqual({
      success: true,
      prUrl: '',
      prWarning: 'GitHub: nope',
    });
    expect(mockCookieSet).toHaveBeenCalledWith('cms-active-branch', 'cms/b', {
      path: '/',
    });
  });

  it('rejects empty branch name', async () => {
    const result = await createBranch({ branchName: '  ', title: 'x' });
    expect(result).toEqual({
      success: false,
      error: 'Branch name is required.',
    });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });

  it('rejects empty workspace title', async () => {
    const result = await createBranch({ branchName: 'cms/x', title: '  ' });
    expect(result).toEqual({
      success: false,
      error: 'Workspace title is required.',
    });
    expect(mockCookieSet).not.toHaveBeenCalled();
  });
});
