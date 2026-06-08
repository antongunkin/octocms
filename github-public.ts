import { Octokit } from 'octokit';

import { getCmsBranchEnv, getPointerFilePath } from './lib/contentBranch';
import { getConfig } from './lib/configStore';
import { ContentSourceError, isContentSourceError, mapGitHubApiErrorToContentSource } from './lib/contentSourceError';

export { isProductionMode, isVercelBuildStep } from './lib/githubContentMode';

const getGitHubConfig = () => ({
  owner: process.env.GITHUB_REPO_OWNER || '',
  repo: process.env.GITHUB_REPO_NAME || '',
  branch: getConfig().git.baseBranch,
});

export const assertGitHubConfig = () => {
  const { owner, repo, branch } = getGitHubConfig();

  if (!owner || !repo) {
    throw new ContentSourceError(
      'github_config',
      'GitHub repository is not configured. Set environment variables GITHUB_REPO_OWNER and GITHUB_REPO_NAME.',
    );
  }

  return { owner, repo, branch };
};

/**
 * Create public-read Octokit clients.
 *
 * 1) Use CMS_GITHUB_TOKEN when available (private repos / higher rate limits).
 *    NOTE: Do NOT use GITHUB_TOKEN — Vercel overrides it with its own system token.
 * 2) Also try unauthenticated reads (public repos) to avoid hard dependency.
 */
export const getPublicOctokits = (): Octokit[] => {
  const token = process.env.CMS_GITHUB_TOKEN?.trim();
  const clients: Octokit[] = [];

  if (token) {
    clients.push(new Octokit({ auth: token }));
  }

  clients.push(new Octokit());

  return clients;
};

/**
 * When `config.git.publishedPointerBranch` is set, per-build pointer files under `cms/pointers/`
 * are read and written on that branch — use an unprotected branch so Publish avoids a protected base branch.
 */
export const getPublishedPointerRef = (): string | undefined => {
  const v = getConfig().git.publishedPointerBranch?.trim();
  return v || undefined;
};

/**
 * Read a file from GitHub using a static server token (no user session required).
 * Used by public pages to fetch content in production.
 */
export const readGitHubFilePublic = async (filePath: string, branch?: string): Promise<string | null> => {
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const ref = branch ?? configBranch;
  const clients = getPublicOctokits();

  let sawAuthError = false;
  for (const octokit of clients) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
        ref,
      });

      if ('content' in data && data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }

      return null;
    } catch (error: any) {
      if (error.status === 429) {
        throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
      }

      if (error.status === 401 || error.status === 403) {
        sawAuthError = true;
        continue;
      }

      if (error.status === 404) {
        // 404 from a client that authenticated successfully = file genuinely missing.
        // 404 only after auth failures = "no access" — keep trying / fall through.
        if (sawAuthError) continue;
        return null;
      }

      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
    }
  }

  // All clients failed and at least one rejected auth — typical for private repos with bad token.
  const tokenPresent = !!process.env.CMS_GITHUB_TOKEN?.trim();
  throw new ContentSourceError(
    'github_auth',
    tokenPresent
      ? `Cannot read ${owner}/${repo} (ref: ${ref}) from GitHub. CMS_GITHUB_TOKEN is set but was rejected — verify it has Contents: Read access on this repository.`
      : `Cannot read ${owner}/${repo} (ref: ${ref}) from GitHub. Set CMS_GITHUB_TOKEN with Contents: Read access on this repository.`,
  );
};

/**
 * List files in a directory from the GitHub repo.
 * Returns an array of file paths.
 *
 * Tries all available Octokit clients in order (authenticated first, then
 * unauthenticated) so that a bad/expired CMS_GITHUB_TOKEN automatically
 * falls back to unauthenticated reads on public repos.
 */
export const listGitHubFiles = async (dirPath: string, extension?: string, branch?: string): Promise<string[]> => {
  const clients = getPublicOctokits();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const ref = branch ?? configBranch;

  let sawAuthError = false;
  for (const octokit of clients) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: dirPath,
        ref,
      });

      if (!Array.isArray(data)) {
        return [];
      }

      let files = data.filter((item) => item.type === 'file').map((item) => item.path);

      if (extension) {
        files = files.filter((f) => f.endsWith(extension));
      }

      return files;
    } catch (error: any) {
      if (error.status === 429) {
        throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
      }
      if (error.status === 401 || error.status === 403) {
        sawAuthError = true;
        continue;
      }
      if (error.status === 404) {
        // 404 from a client that authenticated = directory genuinely missing.
        // 404 after auth failures = "no access" — keep trying / fall through.
        if (sawAuthError) continue;
        return [];
      }
      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
    }
  }

  const tokenPresent = !!process.env.CMS_GITHUB_TOKEN?.trim();
  throw new ContentSourceError(
    'github_auth',
    tokenPresent
      ? `Cannot list ${owner}/${repo}/${dirPath} (ref: ${ref}) from GitHub. CMS_GITHUB_TOKEN is set but was rejected — verify it has Contents: Read access on this repository.`
      : `Cannot list ${owner}/${repo}/${dirPath} (ref: ${ref}) from GitHub. Set CMS_GITHUB_TOKEN with Contents: Read access on this repository.`,
  );
};

/**
 * List files recursively across subdirectories (public read — same token/session
 * strategy as {@link listGitHubFiles}).
 */
export const listGitHubFilesRecursive = async (
  dirPath: string,
  extension?: string,
  branch?: string,
): Promise<string[]> => {
  const [octokit] = getPublicOctokits();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const ref = branch ?? configBranch;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: dirPath,
      ref,
    });

    if (!Array.isArray(data)) {
      return [];
    }

    const results: string[] = [];

    for (const item of data) {
      if (item.type === 'file') {
        if (!extension || item.path.endsWith(extension)) {
          results.push(item.path);
        }
      } else if (item.type === 'dir') {
        const subFiles = await listGitHubFilesRecursive(item.path, extension, branch);
        results.push(...subFiles);
      }
    }

    return results;
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
  }
};

/**
 * Returns true when `heads/<branchName>` exists on the remote.
 */
export const branchExistsOnGitHub = async (branchName: string): Promise<boolean> => {
  const { owner, repo } = assertGitHubConfig();
  const clients = getPublicOctokits();

  let sawAuthError = false;
  for (const octokit of clients) {
    try {
      await octokit.rest.git.getRef({
        owner,
        repo,
        ref: `heads/${branchName}`,
      });
      return true;
    } catch (error: any) {
      if (error.status === 404) {
        if (sawAuthError) continue;
        return false;
      }
      if (error.status === 401 || error.status === 403) {
        sawAuthError = true;
        continue;
      }
      if (error.status === 429) {
        throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref: branchName });
      }
      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref: branchName });
    }
  }

  const tokenPresent = !!process.env.CMS_GITHUB_TOKEN?.trim();
  throw new ContentSourceError(
    'github_auth',
    tokenPresent
      ? `Cannot verify branch ${branchName} on ${owner}/${repo}. CMS_GITHUB_TOKEN is set but was rejected — verify it has Contents: Read access on this repository.`
      : `Cannot verify branch ${branchName} on ${owner}/${repo}. Set CMS_GITHUB_TOKEN with Contents: Read access on this repository.`,
  );
};

/**
 * List remote branch names whose ref starts with `refs/heads/<prefix>` (prefix should look like `cms/`).
 */
export const listGitHubBranchRefsByPrefix = async (prefix: string): Promise<string[]> => {
  const { owner, repo } = assertGitHubConfig();
  const normalized = prefix.replace(/^\/+/, '');
  const refParam = normalized.endsWith('/') ? `heads/${normalized}` : `heads/${normalized}/`;
  const clients = getPublicOctokits();

  let sawAuthError = false;
  for (const octokit of clients) {
    try {
      const { data } = await octokit.rest.git.listMatchingRefs({
        owner,
        repo,
        ref: refParam,
      });
      return data.map((r) => r.ref.replace(/^refs\/heads\//, '')).filter((name): name is string => Boolean(name));
    } catch (error: any) {
      if (error.status === 429) {
        throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref: refParam });
      }
      if (error.status === 401 || error.status === 403) {
        sawAuthError = true;
        continue;
      }
      if (error.status === 404) {
        if (sawAuthError) continue;
        return [];
      }
      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref: refParam });
    }
  }

  const tokenPresent = !!process.env.CMS_GITHUB_TOKEN?.trim();
  throw new ContentSourceError(
    'github_auth',
    tokenPresent
      ? `Cannot list branch refs ${owner}/${repo} (${refParam}). CMS_GITHUB_TOKEN is set but was rejected — verify it has Contents: Read access on this repository.`
      : `Cannot list branch refs ${owner}/${repo} (${refParam}). Set CMS_GITHUB_TOKEN with Contents: Read access on this repository.`,
  );
};

/**
 * Resolve which Git branch public reads use.
 *
 * Precedence:
 * 1. `{ "branch": "<name>", "buildId": "<id>" }` from {@link getPointerFilePath} on the pointer ref (or base branch); only `branch` is used for resolution
 * 2. `CMS_BRANCH` env var when the branch exists
 * 3. `config.git.baseBranch`
 *
 * If the pointer file or `CMS_BRANCH` names a branch that does not exist, falls back to the next step.
 */
export const resolveContentBranch = async (): Promise<string> => {
  const { branch: configBranch } = assertGitHubConfig();
  const pointerRef = getPublishedPointerRef() ?? configBranch;
  const pointerPath = getPointerFilePath();

  /** Dedupe `git.getRef` within this resolution (pointer branch vs `CMS_BRANCH` may repeat). */
  const existsCache = new Map<string, Promise<boolean>>();
  const pickIfExists = async (name: string | undefined | null): Promise<string | null> => {
    if (!name || typeof name !== 'string') return null;
    const b = name.trim();
    if (!b) return null;
    if (b === configBranch) return configBranch;
    let pending = existsCache.get(b);
    if (!pending) {
      pending = branchExistsOnGitHub(b);
      existsCache.set(b, pending);
    }
    if (await pending) return b;
    return null;
  };

  let content: string | null;
  try {
    content = await readGitHubFilePublic(pointerPath, pointerRef);
  } catch (e) {
    if (isContentSourceError(e)) throw e;
    content = null;
  }

  if (content) {
    try {
      const parsed = JSON.parse(content) as { branch?: unknown };
      if (typeof parsed.branch === 'string') {
        const picked = await pickIfExists(parsed.branch);
        if (picked) return picked;
      }
    } catch {
      /* fall through */
    }
  }

  const envBranch = getCmsBranchEnv();
  if (envBranch) {
    const picked = await pickIfExists(envBranch);
    if (picked) return picked;
  }

  return configBranch;
};
