import { Octokit } from 'octokit';

import { getConfig } from './lib/configStore';
import { ContentSourceError, isContentSourceError, mapGitHubApiErrorToContentSource } from './lib/contentSourceError';

export { isProductionMode } from './lib/githubContentMode';

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
 * When `config.git.publishedPointerBranch` is set, `cms/published.json` is read and written on
 * that branch — use an unprotected branch so Publish avoids a protected base branch.
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
        // Try next client (e.g. unauthenticated) before giving up.
        continue;
      }

      if (error.status === 404) {
        // 404 can mean missing file, missing ref, or no repo access.
        // Try next client if available before deciding.
        continue;
      }

      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
    }
  }

  // All clients failed — typical for private repos or invalid token permissions.
  throw new ContentSourceError(
    'github_auth',
    `Cannot read ${owner}/${repo} (ref: ${ref}) from GitHub. For private repositories, set CMS_GITHUB_TOKEN with Contents: Read access on this repository.`,
  );
};

/**
 * List files in a directory from the GitHub repo.
 * Returns an array of file paths.
 */
export const listGitHubFiles = async (dirPath: string, extension?: string, branch?: string): Promise<string[]> => {
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

    let files = data.filter((item) => item.type === 'file').map((item) => item.path);

    if (extension) {
      files = files.filter((f) => f.endsWith(extension));
    }

    return files;
  } catch (error: any) {
    if (error.status === 404) {
      return [];
    }
    throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
  }
};

/**
 * Read cms/published.json to determine which branch public pages read content from.
 * Uses {@link getPublishedPointerRef} when set; otherwise reads from `config.git.baseBranch`.
 * Falls back to base branch on missing file or invalid JSON.
 */
export const getPublishedBranch = async (): Promise<string> => {
  const { branch: configBranch } = assertGitHubConfig();
  const pointerRef = getPublishedPointerRef();

  try {
    const content = await readGitHubFilePublic('cms/published.json', pointerRef);
    if (!content) return configBranch;
    const parsed = JSON.parse(content);
    return typeof parsed.branch === 'string' ? parsed.branch : configBranch;
  } catch (e) {
    if (isContentSourceError(e)) throw e;
    return configBranch;
  }
};
