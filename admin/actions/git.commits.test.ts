import { beforeEach, describe, expect, it, vi } from 'vitest';

import * as github from '../github';
import { getEntryCommits } from './git';

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

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => true),
  assertGitHubConfig: vi.fn(() => ({ owner: 'acme', repo: 'site', branch: 'main' })),
  getPublicOctokits: vi.fn(() => []),
  saveGitHubFile: vi.fn(),
  getPublishedPointerRef: vi.fn(),
  markPRReadyForReview: vi.fn(),
  createGitHubBranch: vi.fn(),
  createGitHubCMSPullRequest: vi.fn(),
  createGitHubPullRequest: vi.fn(),
  listGitHubCMSPullRequests: vi.fn(),
  getGitHubFile: vi.fn(),
  getPublishedBranch: vi.fn(),
}));

vi.mock('./files', () => ({
  waitForPublicReadConsistency: vi.fn(),
}));

vi.mock('./build', () => ({
  buildJsons: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock('../store/contentStore', () => ({
  warmBranch: vi.fn(),
}));

vi.mock('../../lib/configStore', () => ({
  getConfig: () => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {},
  }),
}));

const buildCommit = (
  overrides: Partial<{
    sha: string;
    message: string;
    authorName: string;
    date: string;
    ghLogin: string | null;
    ghAvatar: string | null;
    htmlUrl: string;
  }> = {},
) => {
  const sha = overrides.sha ?? 'abcdef1234567890';
  return {
    sha,
    html_url: overrides.htmlUrl ?? `https://github.com/acme/site/commit/${sha}`,
    commit: {
      message: overrides.message ?? 'Update post title',
      author: {
        name: overrides.authorName ?? 'Ada Lovelace',
        email: 'ada@example.com',
        date: overrides.date ?? '2026-04-10T12:00:00Z',
      },
      committer: {
        name: 'GitHub',
        email: 'noreply@github.com',
        date: overrides.date ?? '2026-04-10T12:00:00Z',
      },
    },
    author:
      overrides.ghLogin === null
        ? null
        : {
            login: overrides.ghLogin ?? 'ada',
            avatar_url: overrides.ghAvatar ?? 'https://avatars.githubusercontent.com/u/1?v=4',
          },
  } as any;
};

const mockOctokit = (commits: any[]) => {
  const listCommits = vi.fn().mockResolvedValue({ data: commits });
  vi.mocked(github.getPublicOctokits).mockReturnValue([{ rest: { repos: { listCommits } } } as any]);
  return listCommits;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockLogCmsServerError.mockReset();
  vi.mocked(github.isProductionMode).mockReturnValue(true);
  vi.mocked(github.assertGitHubConfig).mockReturnValue({ owner: 'acme', repo: 'site', branch: 'main' });
});

describe('getEntryCommits', () => {
  it('returns empty shape and does not call Octokit in dev mode', async () => {
    vi.mocked(github.isProductionMode).mockReturnValue(false);
    const listCommits = mockOctokit([]);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(result).toEqual({ commits: [], seeAllUrl: '' });
    expect(listCommits).not.toHaveBeenCalled();
  });

  it('returns empty shape when filePath is empty', async () => {
    const listCommits = mockOctokit([]);

    const result = await getEntryCommits('');

    expect(result).toEqual({ commits: [], seeAllUrl: '' });
    expect(listCommits).not.toHaveBeenCalled();
  });

  it('maps commits with shortSha, first-line message, author and URL; builds seeAllUrl', async () => {
    const listCommits = mockOctokit([
      buildCommit({ sha: '1111111aaaaa', message: 'First commit', date: '2026-04-10T12:00:00Z' }),
      buildCommit({ sha: '2222222bbbbb', message: 'Second commit', date: '2026-04-11T12:00:00Z' }),
      buildCommit({ sha: '3333333ccccc', message: 'Third commit', date: '2026-04-12T12:00:00Z' }),
    ]);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(listCommits).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'site',
      path: 'cms/content/post/post-abc.json',
      per_page: 5,
    });
    expect(result.commits).toHaveLength(3);
    expect(result.commits[0]).toEqual({
      sha: '1111111aaaaa',
      shortSha: '1111111',
      message: 'First commit',
      author: {
        login: 'ada',
        name: 'Ada Lovelace',
        avatarUrl: 'https://avatars.githubusercontent.com/u/1?v=4',
      },
      committedAt: '2026-04-10T12:00:00Z',
      url: 'https://github.com/acme/site/commit/1111111aaaaa',
    });
    expect(result.seeAllUrl).toBe('https://github.com/acme/site/commits/main/cms/content/post/post-abc.json');
  });

  it('falls back when the GitHub author is unmatched (null)', async () => {
    mockOctokit([buildCommit({ sha: '9999999dddd', ghLogin: null, authorName: 'Anonymous Contributor' })]);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(result.commits[0].author).toEqual({
      login: null,
      name: 'Anonymous Contributor',
      avatarUrl: null,
    });
  });

  it('trims multiline commit messages to the first line', async () => {
    mockOctokit([
      buildCommit({
        sha: 'aaaaaaa1111',
        message: 'Title line\n\nDetailed body paragraph.\nMore detail.',
      }),
    ]);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(result.commits[0].message).toBe('Title line');
  });

  it('returns at most 5 commits even if API returns more', async () => {
    const commits = Array.from({ length: 10 }, (_, i) =>
      buildCommit({ sha: `${i}`.repeat(7) + `xxxxxx${i}`, message: `Commit ${i}` }),
    );
    mockOctokit(commits);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(result.commits).toHaveLength(5);
  });

  it('returns empty shape and logs when Octokit throws', async () => {
    const listCommits = vi.fn().mockRejectedValue(new Error('Network fail'));
    vi.mocked(github.getPublicOctokits).mockReturnValue([{ rest: { repos: { listCommits } } } as any]);

    const result = await getEntryCommits('cms/content/post/post-abc.json');

    expect(result).toEqual({ commits: [], seeAllUrl: '' });
    expect(mockLogCmsServerError).toHaveBeenCalledTimes(1);
    expect(mockLogCmsServerError).toHaveBeenCalledWith({
      operation: 'getEntryCommits',
      message: 'Network fail',
    });
  });
});
