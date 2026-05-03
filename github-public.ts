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
 * Read cms/published.json to determine which branch public pages read content from.
 * Uses {@link getPublishedPointerRef} when set; otherwise reads from `config.git.baseBranch`.
 * Falls back to base branch on missing file or invalid JSON.
 */
export const getPublishedBranch = async (): Promise<string> => {
  const { branch: configBranch } = assertGitHubConfig();
  const pointerRef = getPublishedPointerRef();

  let content: string | null;
  try {
    content = await readGitHubFilePublic('cms/published.json', pointerRef);
  } catch (e) {
    // Auth / network / rate-limit signals a real prod problem — let it bubble.
    // The pointer file itself is optional, but if we can't even reach GitHub
    // to check, downstream content reads will fail too; surface the cause.
    if (isContentSourceError(e)) throw e;
    return configBranch;
  }

  if (!content) return configBranch;
  try {
    const parsed = JSON.parse(content);
    return typeof parsed.branch === 'string' ? parsed.branch : configBranch;
  } catch {
    return configBranch;
  }
};
