import { Octokit } from 'octokit';
import { getServerSession } from 'next-auth';

import { logCmsServerError } from '../lib/cmsServerLog';
import { mapGitHubApiErrorToContentSource } from '../lib/contentSourceError';

import { authOptions } from './auth';

import {
  assertGitHubConfig,
  getPublicOctokits,
  getPublishedPointerRef,
  readGitHubFilePublic,
  listGitHubFiles,
  listGitHubFilesRecursive,
  listGitHubBranchRefsByPrefix,
  resolveContentBranch,
  isProductionMode,
} from '../github-public';

export {
  assertGitHubConfig,
  getPublicOctokits,
  getPublishedPointerRef,
  readGitHubFilePublic,
  listGitHubFiles,
  listGitHubFilesRecursive,
  listGitHubBranchRefsByPrefix,
  resolveContentBranch,
  isProductionMode,
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
};

const formatGitHubApiError = (error: any): string => {
  const status = error?.status;
  const message = error?.response?.data?.message || error?.message || getErrorMessage(error);

  if (status) {
    return `${status} ${message}`;
  }

  return message;
};

const getDefaultBranchRef = async (octokit: Octokit, owner: string, repo: string): Promise<string> => {
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const defaultBranch = repoData.default_branch || 'main';
  const { data: defaultRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${defaultBranch}`,
  });

  return defaultRef.object.sha;
};

const ensureBranchExists = async (octokit: Octokit, owner: string, repo: string, branch: string) => {
  try {
    await octokit.rest.git.getRef({
      owner,
      repo,
      ref: `heads/${branch}`,
    });
  } catch (error: any) {
    if (error.status !== 404) {
      throw error;
    }

    const baseSha = await getDefaultBranchRef(octokit, owner, repo);

    await octokit.rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: baseSha,
    });
  }
};

const getOctokit = async () => {
  const session = await getServerSession(authOptions);
  const accessToken = (session as any)?.accessToken;

  if (!accessToken) {
    throw new Error('No GitHub access token found. Please sign in again.');
  }

  return new Octokit({ auth: accessToken });
};

/**
 * Get an Octokit client suitable for write operations (save, delete, create PR).
 * Prefers CMS_GITHUB_TOKEN so it works even when the GitHub App is not installed
 * on the target repo. Falls back to the user session token.
 */
const getWriteOctokit = async (): Promise<Octokit> => {
  const token = process.env.CMS_GITHUB_TOKEN?.trim();

  if (token) {
    return new Octokit({ auth: token });
  }

  return getOctokit();
};

/**
 * Read a binary file from GitHub using a static server token (no user session required).
 * If `branch` is provided, reads from that branch directly (used by the media route
 * so editors see uploads on their active feature branch before publishing).
 * Otherwise uses {@link resolveContentBranch} so assets match the same ref as
 * `query()` / public JSON (not only `git.baseBranch`).
 * Returns a Buffer, or null if the file does not exist.
 */
export const readGitHubBinaryFilePublic = async (filePath: string, branch?: string): Promise<Buffer | null> => {
  const { owner, repo } = assertGitHubConfig();
  const ref = branch ?? (await resolveContentBranch());
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
        return Buffer.from(data.content.replace(/\n/g, ''), 'base64');
      }

      return null;
    } catch (error: any) {
      if (error.status === 429) {
        throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
      }

      if (error.status === 401 || error.status === 403 || error.status === 404) {
        continue;
      }

      throw mapGitHubApiErrorToContentSource(error, { owner, repo, ref });
    }
  }

  return null;
};

/**
 * Get a file's content and SHA from the GitHub repo.
 * Returns { content, sha } or null if the file doesn't exist.
 */
export const getGitHubFile = async (
  filePath: string,
  branch?: string,
): Promise<{ content: string; sha: string } | null> => {
  const [octokit] = getPublicOctokits();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const ref = branch || configBranch;

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: filePath,
      ref,
    });

    if ('content' in data && data.type === 'file') {
      const content = Buffer.from(data.content, 'base64').toString('utf-8');
      return { content, sha: data.sha };
    }

    return null;
  } catch (error: any) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Create or update a file in the GitHub repo via a commit.
 *
 * @param existingSha  Optional SHA of the existing file blob. When provided from
 *                     the content store, skips the pre-read API call (saves 1 request per write).
 */
export const saveGitHubFile = async (
  filePath: string,
  content: string,
  message: string,
  branch?: string,
  existingSha?: string,
) => {
  const octokit = await getWriteOctokit();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const targetBranch = branch || configBranch;

  await ensureBranchExists(octokit, owner, repo, targetBranch);

  // Get existing file SHA if it exists (required for updates) — skip when caller provides it
  const existing = existingSha ? { sha: existingSha } : await getGitHubFile(filePath, targetBranch);

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: Buffer.from(content).toString('base64'),
      branch: targetBranch,
      ...(existing ? { sha: existing.sha } : {}),
    });
  } catch (error: any) {
    if (error.status === 403) {
      throw new Error(
        'GitHub token is missing repository write permissions. Ensure the app is installed on the repo and has Contents: Read and write permission.',
      );
    }

    if (error.status === 409) {
      throw new Error(
        'GitHub rejected the commit due to branch protection or write conflicts. Use a writable branch (for example cms/edits) or relax direct-push protection on main.',
      );
    }

    if (error.status === 422) {
      throw new Error(`GitHub validation failed while saving content: ${formatGitHubApiError(error)}`);
    }

    throw new Error(`GitHub save failed: ${formatGitHubApiError(error)}`);
  }
};

/**
 * Create or update a binary file in the GitHub repo via a commit.
 * Unlike saveGitHubFile, this accepts a Buffer directly to avoid encoding corruption.
 */
export const saveGitHubBinaryFile = async (filePath: string, buffer: Buffer, message: string, branch?: string) => {
  const octokit = await getWriteOctokit();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const targetBranch = branch || configBranch;

  await ensureBranchExists(octokit, owner, repo, targetBranch);

  const existing = await getGitHubFile(filePath, targetBranch);

  try {
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: filePath,
      message,
      content: buffer.toString('base64'),
      branch: targetBranch,
      ...(existing ? { sha: existing.sha } : {}),
    });
  } catch (error: any) {
    if (error.status === 403) {
      throw new Error(
        'GitHub token is missing repository write permissions. Ensure the app is installed on the repo and has Contents: Read and write permission.',
      );
    }

    if (error.status === 409) {
      throw new Error(
        'GitHub rejected the commit due to branch protection or write conflicts. Use a writable branch (for example cms/edits) or relax direct-push protection on main.',
      );
    }

    if (error.status === 422) {
      throw new Error(`GitHub validation failed while saving content: ${formatGitHubApiError(error)}`);
    }

    throw new Error(`GitHub save failed: ${formatGitHubApiError(error)}`);
  }
};

/**
 * A single file change in a multi-file commit. `delete` removes the path
 * from the tree; `upsert-text` and `upsert-binary` create or update it.
 */
export type GitHubBatchChange =
  | { kind: 'upsert-text'; path: string; content: string }
  | { kind: 'upsert-binary'; path: string; content: Buffer }
  | { kind: 'delete'; path: string };

/**
 * Commit multiple file changes atomically as a single GitHub commit on
 * `branch`. Used by the visual schema editor to write `cms/schema.json`
 * plus regenerated artifacts plus migrated entry files in one commit.
 *
 * Implementation: builds a git tree off the branch's current HEAD, creates a
 * single commit, then fast-forwards the branch. If `branch` does not exist,
 * it is created from `git.baseBranch` first (mirrors `ensureBranchExists`).
 *
 * Throws if all `changes` are no-ops (e.g. all deletes target missing paths)
 * — GitHub rejects empty trees.
 */
export const commitMultipleFilesToGitHub = async (
  changes: readonly GitHubBatchChange[],
  message: string,
  branch?: string,
): Promise<{ sha: string }> => {
  if (changes.length === 0) {
    throw new Error('commitMultipleFilesToGitHub: no changes provided');
  }

  const octokit = await getWriteOctokit();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const targetBranch = branch || configBranch;

  await ensureBranchExists(octokit, owner, repo, targetBranch);

  const { data: ref } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${targetBranch}`,
  });
  const headSha = ref.object.sha;

  const { data: headCommit } = await octokit.rest.git.getCommit({
    owner,
    repo,
    commit_sha: headSha,
  });
  const baseTreeSha = headCommit.tree.sha;

  const tree: {
    path: string;
    mode: '100644';
    type: 'blob';
    sha?: string | null;
    content?: string;
  }[] = [];

  for (const change of changes) {
    if (change.kind === 'delete') {
      tree.push({ path: change.path, mode: '100644', type: 'blob', sha: null });
      continue;
    }
    if (change.kind === 'upsert-text') {
      // Push content directly. GitHub will create a blob server-side.
      tree.push({ path: change.path, mode: '100644', type: 'blob', content: change.content });
      continue;
    }
    // Binary: must upload as a blob first, then reference its SHA.
    const { data: blob } = await octokit.rest.git.createBlob({
      owner,
      repo,
      content: change.content.toString('base64'),
      encoding: 'base64',
    });
    tree.push({ path: change.path, mode: '100644', type: 'blob', sha: blob.sha });
  }

  let newTreeSha: string;
  try {
    const { data: newTree } = await octokit.rest.git.createTree({
      owner,
      repo,
      base_tree: baseTreeSha,
      tree,
    });
    newTreeSha = newTree.sha;
  } catch (error: any) {
    throw new Error(`GitHub createTree failed: ${formatGitHubApiError(error)}`);
  }

  if (newTreeSha === baseTreeSha) {
    throw new Error('commitMultipleFilesToGitHub: changes produced no diff (every file was already up to date)');
  }

  const { data: newCommit } = await octokit.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTreeSha,
    parents: [headSha],
  });

  try {
    await octokit.rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${targetBranch}`,
      sha: newCommit.sha,
    });
  } catch (error: any) {
    if (error.status === 422) {
      throw new Error(
        `Branch "${targetBranch}" moved while committing. Retry the schema save: ${formatGitHubApiError(error)}`,
      );
    }
    throw new Error(`GitHub updateRef failed: ${formatGitHubApiError(error)}`);
  }

  return { sha: newCommit.sha };
};

/**
 * Delete a file from the GitHub repo via a commit.
 */
export const deleteGitHubFile = async (filePath: string, message: string, branch?: string) => {
  const octokit = await getWriteOctokit();
  const { owner, repo, branch: configBranch } = assertGitHubConfig();
  const targetBranch = branch || configBranch;

  const existing = await getGitHubFile(filePath, targetBranch);

  if (!existing) {
    return; // File doesn't exist, nothing to delete
  }

  await octokit.rest.repos.deleteFile({
    owner,
    repo,
    path: filePath,
    message,
    sha: existing.sha,
    branch: targetBranch,
  });
};

/**
 * Create a new branch in the GitHub repo from `config.git.baseBranch`.
 */
export const createGitHubBranch = async (branchName: string): Promise<void> => {
  const octokit = await getWriteOctokit();
  const { owner, repo, branch: baseBranch } = assertGitHubConfig();

  const { data: baseRef } = await octokit.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${baseBranch}`,
  });

  await octokit.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.object.sha,
  });
};

const ensureLabelExists = async (octokit: Octokit, owner: string, repo: string, name: string, color: string) => {
  try {
    await octokit.rest.issues.getLabel({ owner, repo, name });
  } catch (error: any) {
    if (error.status === 404) {
      await octokit.rest.issues.createLabel({
        owner,
        repo,
        name,
        color,
        description: 'Content updates from the CMS editor',
      });
    } else {
      throw error;
    }
  }
};

/**
 * Create a draft pull request for a CMS branch, adding the 'cms-update' label.
 */
export const createGitHubCMSPullRequest = async (
  headBranch: string,
  title: string,
  body: string,
  targetBranch: string,
): Promise<{ url: string; number: number }> => {
  const octokit = await getWriteOctokit();
  const { owner, repo } = assertGitHubConfig();

  let data: { html_url: string; number: number };

  try {
    const res = await octokit.rest.pulls.create({
      owner,
      repo,
      title,
      body,
      head: headBranch,
      base: targetBranch,
      draft: true,
    });
    data = res.data;
  } catch (error: any) {
    const detail = formatGitHubApiError(error);
    logCmsServerError({
      operation: 'pulls.create',
      branch: headBranch,
      status: error?.status,
      message: detail,
    });

    if (error?.status === 422) {
      const lower = detail.toLowerCase();
      if (lower.includes('no commits between')) {
        throw new Error(
          'Could not open draft pull request: GitHub reports no new commits on this branch versus the base branch. Save branch metadata should have created a commit — please try again or open a pull request manually on GitHub.',
        );
      }

      throw new Error(`Could not open draft pull request: ${detail}`);
    }

    throw new Error(`Could not open draft pull request: ${detail}`);
  }

  try {
    await ensureLabelExists(octokit, owner, repo, 'cms-update', '0075ca');
    await octokit.rest.issues.addLabels({
      owner,
      repo,
      issue_number: data.number,
      labels: ['cms-update'],
    });
  } catch (_e) {
    // Label is cosmetic — don't fail branch creation if labelling errors
  }

  return { url: data.html_url, number: data.number };
};

/**
 * List all open PRs tagged with the 'cms-update' label.
 */
export const listGitHubCMSPullRequests = async (): Promise<
  { branch: string; prUrl: string; prNumber: number; title: string }[]
> => {
  const octokit = await getWriteOctokit();
  const { owner, repo } = assertGitHubConfig();

  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    state: 'open',
    per_page: 100,
  });

  return prs
    .filter((pr) => pr.labels.some((l) => l.name === 'cms-update'))
    .map((pr) => ({
      branch: pr.head.ref,
      prUrl: pr.html_url,
      prNumber: pr.number,
      title: pr.title,
    }));
};

/**
 * Create a pull request from the configured branch to the target branch.
 */
export const createGitHubPullRequest = async (
  title: string,
  body: string,
  targetBranch: string = 'main',
): Promise<{ url: string; number: number }> => {
  const octokit = await getWriteOctokit();
  const { owner, repo, branch } = assertGitHubConfig();

  if (branch === targetBranch) {
    throw new Error(`Cannot create PR: source branch "${branch}" is the same as target branch "${targetBranch}"`);
  }

  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head: branch,
    base: targetBranch,
  });

  return { url: data.html_url, number: data.number };
};

/**
 * Merge a pull request via squash.
 */
export const mergePullRequest = async (prNumber: number): Promise<void> => {
  const octokit = await getWriteOctokit();
  const { owner, repo } = assertGitHubConfig();

  await octokit.rest.pulls.merge({
    owner,
    repo,
    pull_number: prNumber,
    merge_method: 'squash',
  });
};

/**
 * Convert a draft pull request for a CMS branch to "Ready for Review".
 * No-op if no open PR exists for the branch or if it is already non-draft.
 */
export const markPRReadyForReview = async (branchName: string): Promise<void> => {
  const octokit = await getWriteOctokit();
  const { owner, repo } = assertGitHubConfig();

  const { data: prs } = await octokit.rest.pulls.list({
    owner,
    repo,
    head: `${owner}:${branchName}`,
    state: 'open',
    per_page: 1,
  });

  const pr = prs[0];
  if (!pr || !pr.draft) return;

  await octokit.graphql(
    `mutation MarkReadyForReview($pullRequestId: ID!) {
      markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
        pullRequest { isDraft }
      }
    }`,
    { pullRequestId: pr.node_id },
  );
};
