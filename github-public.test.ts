import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { assertGitHubConfig, getPublishedBranch, listGitHubFiles, readGitHubFilePublic } from './github-public';
import { isContentSourceError } from './lib/contentSourceError';

const pointerState = vi.hoisted(() => ({ publishedPointerBranch: undefined as string | undefined }));

const mockConfig = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png'],
  git: {
    baseBranch: 'main',
    get publishedPointerBranch() {
      return pointerState.publishedPointerBranch;
    },
  },
  collections: {},
} as any;

vi.mock('./lib/configStore', () => ({ getConfig: () => mockConfig }));

const octokitState = vi.hoisted(() => ({
  queue: [] as Array<(args: any) => any>,
}));

vi.mock('octokit', () => ({
  Octokit: function MockOctokit() {
    return {
      rest: {
        repos: {
          getContent: (args: any) => {
            const fn = octokitState.queue.shift();
            if (!fn) throw new Error('No mock response configured (queue empty)');
            return fn(args);
          },
        },
      },
    };
  },
}));

function makeFileResponse(content: string) {
  return async () => ({
    data: { type: 'file', content: Buffer.from(content, 'utf-8').toString('base64') },
  });
}

function makeDirResponse(items: Array<{ type: 'file' | 'dir'; path: string }>) {
  return async () => ({ data: items });
}

function makeError(status: number, message = 'mock'): never {
  const err: any = new Error(message);
  err.status = status;
  err.response = { data: { message } };
  throw err;
}

const ORIG_ENV = { ...process.env };

beforeEach(() => {
  process.env.GITHUB_REPO_OWNER = 'octo';
  process.env.GITHUB_REPO_NAME = 'cms';
  delete process.env.CMS_GITHUB_TOKEN;
  octokitState.queue = [];

  pointerState.publishedPointerBranch = undefined;
});

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('assertGitHubConfig', () => {
  it('throws github_config when owner missing', () => {
    process.env.GITHUB_REPO_OWNER = '';
    try {
      assertGitHubConfig();
      throw new Error('should have thrown');
    } catch (e) {
      expect(isContentSourceError(e) && e.code).toBe('github_config');
    }
  });

  it('throws github_config when repo missing', () => {
    process.env.GITHUB_REPO_NAME = '';
    try {
      assertGitHubConfig();
      throw new Error('should have thrown');
    } catch (e) {
      expect(isContentSourceError(e) && e.code).toBe('github_config');
    }
  });

  it('returns owner/repo/branch when configured', () => {
    expect(assertGitHubConfig()).toEqual({ owner: 'octo', repo: 'cms', branch: 'main' });
  });
});

describe('readGitHubFilePublic', () => {
  it('returns content from auth client on 200', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [makeFileResponse('hello'), () => makeError(404)];
    expect(await readGitHubFilePublic('a.json')).toBe('hello');
  });

  it('falls back from 401 auth to 200 unauth', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(401), makeFileResponse('public')];
    expect(await readGitHubFilePublic('a.json')).toBe('public');
  });

  it('returns null on 404 from auth client (file genuinely missing)', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(404)];
    expect(await readGitHubFilePublic('missing.json')).toBeNull();
  });

  it('throws github_auth on 401 + 404 (no access)', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(401), () => makeError(404)];
    await expect(readGitHubFilePublic('a.json')).rejects.toMatchObject({ code: 'github_auth' });
  });

  it('throws github_rate_limit on 429 immediately', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(429)];
    await expect(readGitHubFilePublic('a.json')).rejects.toMatchObject({ code: 'github_rate_limit' });
  });

  it('throws github_unavailable on 500', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(500)];
    await expect(readGitHubFilePublic('a.json')).rejects.toMatchObject({ code: 'github_unavailable' });
  });

  it('throws github_unavailable on network error', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [
      () => {
        const err: any = new Error('fetch failed');
        throw err;
      },
    ];
    await expect(readGitHubFilePublic('a.json')).rejects.toMatchObject({ code: 'github_unavailable' });
  });
});

describe('listGitHubFiles', () => {
  it('returns only files filtered by extension', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [
      makeDirResponse([
        { type: 'file', path: 'cms/content/post/a.json' },
        { type: 'dir', path: 'cms/content/post/sub' },
        { type: 'file', path: 'cms/content/post/b.md' },
      ]),
    ];
    expect(await listGitHubFiles('cms/content/post', '.json')).toEqual(['cms/content/post/a.json']);
  });

  it('returns [] on 404 from auth client (dir missing)', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(404)];
    expect(await listGitHubFiles('cms/content/missing')).toEqual([]);
  });

  it('throws github_auth on 401 + 404 (no access)', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(401), () => makeError(404)];
    await expect(listGitHubFiles('cms/content/post')).rejects.toMatchObject({ code: 'github_auth' });
  });

  it('throws github_rate_limit on 429', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(429)];
    await expect(listGitHubFiles('cms/content/post')).rejects.toMatchObject({ code: 'github_rate_limit' });
  });
});

describe('getPublishedBranch', () => {
  it('returns parsed branch when pointer file is valid JSON', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [makeFileResponse(JSON.stringify({ branch: 'feature/x' }))];
    expect(await getPublishedBranch()).toBe('feature/x');
  });

  it('returns configBranch when pointer file is missing (404)', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(404)];
    expect(await getPublishedBranch()).toBe('main');
  });

  it('returns configBranch when pointer JSON is invalid', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [makeFileResponse('not json {{{')];
    expect(await getPublishedBranch()).toBe('main');
  });

  it('throws on auth error from underlying read', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(401), () => makeError(404)];
    await expect(getPublishedBranch()).rejects.toMatchObject({ code: 'github_auth' });
  });

  it('throws on rate limit from underlying read', async () => {
    process.env.CMS_GITHUB_TOKEN = 'tok';
    octokitState.queue = [() => makeError(429)];
    await expect(getPublishedBranch()).rejects.toMatchObject({ code: 'github_rate_limit' });
  });
});
