'use server';

import './registerConfig';

import { execFile } from 'node:child_process';

import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';

import {
  assertGitHubConfig,
  createGitHubBranch,
  createGitHubCMSPullRequest,
  createGitHubPullRequest,
  getGitHubFile,
  getPublicOctokits,
  getPublishedPointerRef,
  isProductionMode,
  listGitHubCMSPullRequests,
  markPRReadyForReview,
  resolveContentBranch,
  saveGitHubFile,
} from '../github';
import type { EntryCommit, EntryCommitHistory } from '../../types';
import {
  BRANCH_HISTORY_FILE_PATH,
  parseBranchHistoryFile,
  serializeBranchHistoryFile,
  upsertBranchWorkspace,
} from '../../lib/branchHistory';
import { logCmsServerError } from '../../lib/cmsServerLog';
import {
  actionErr,
  actionOk,
  getErrorMessage,
  type ActionResult,
  type CreateBranchInput,
  type CreateBranchResult,
  type CreatePRResult,
} from './utils';
import { getPointerFilePath, serializePointerPayload } from '../../lib/contentBranch';
import { warmBranch } from '../store/contentStore';
import { buildJsons } from './build';
import { waitForPublicReadConsistency } from './files';

const CMS_BRANCH_COOKIE = 'cms-active-branch';

export const pushToGit = async (): Promise<ActionResult> => {
  if (isProductionMode()) {
    // In production, commits are made via GitHub API on each save — no push needed
    return actionOk();
  }

  try {
    const cookieStore = await cookies();
    const activeBranch = cookieStore.get(CMS_BRANCH_COOKIE)?.value;
    const pushCmd = activeBranch
      ? `git commit -am CommitFromCMS && git push origin HEAD:${activeBranch}`
      : 'git commit -am CommitFromCMS && git push';

    await new Promise<void>((resolve, reject) => {
      execFile('sh', ['-c', pushCmd], (error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed git push: ${getErrorMessage(e)}`));
  }
};

export const createPR = async (): Promise<CreatePRResult> => {
  const config = getConfig();
  const baseBranch = config.git.baseBranch;
  const title = `CMS content update (${new Date().toISOString().split('T')[0]})`;
  const body = `Content changes from the CMS editor.\n\nSource branch: \`${baseBranch}\``;

  try {
    const { url, number } = await createGitHubPullRequest(title, body, baseBranch);
    return { success: true, url, number };
  } catch (e) {
    return actionErr(e);
  }
};

export const getIsProduction = async () => {
  return isProductionMode();
};

/**
 * Get the currently active CMS branch.
 * In dev: falls back to the local git branch name.
 * In prod: falls back to `config.git.baseBranch`.
 */
export const getBranch = async (): Promise<string> => {
  const cookieStore = await cookies();
  const activeBranch = cookieStore.get(CMS_BRANCH_COOKIE)?.value;

  if (activeBranch) return activeBranch;

  if (!isProductionMode()) {
    try {
      return await new Promise<string>((resolve, reject) => {
        execFile('git', ['branch', '--show-current'], (error, stdout) => {
          if (error) reject(error);
          else resolve(stdout.trim());
        });
      });
    } catch (_e) {
      // fall through to config.git.baseBranch
    }
  }

  return getConfig().git.baseBranch;
};

/**
 * Returns true if a CMS feature branch is currently active (cookie is set).
 */
export const hasActiveBranch = async (): Promise<boolean> => {
  const cookieStore = await cookies();
  return !!cookieStore.get(CMS_BRANCH_COOKIE)?.value;
};

/**
 * Create a GitHub branch from `config.git.baseBranch`, commit `cms/branch-history.json` so the
 * branch has at least one commit, open a draft PR with the `cms-update` label (best effort),
 * and set the active CMS branch cookie.
 */
export const createBranch = async (input: CreateBranchInput): Promise<CreateBranchResult> => {
  const config = getConfig();
  const branchName = input.branchName.trim();
  const workspaceTitle = input.title.trim();
  const description = input.description?.trim();

  if (!branchName) {
    return { success: false, error: 'Branch name is required.' };
  }

  if (!workspaceTitle) {
    return { success: false, error: 'Workspace title is required.' };
  }

  const baseBranch = config.git.baseBranch;

  try {
    await createGitHubBranch(branchName);

    const historyRaw = await getGitHubFile(BRANCH_HISTORY_FILE_PATH, baseBranch);
    const historyDoc = parseBranchHistoryFile(historyRaw?.content ?? '');
    const merged = upsertBranchWorkspace(historyDoc, branchName, {
      title: workspaceTitle,
      ...(description ? { description } : {}),
      createdAt: new Date().toISOString(),
    });
    const historyContent = serializeBranchHistoryFile(merged);

    await saveGitHubFile(BRANCH_HISTORY_FILE_PATH, historyContent, 'CMS: add branch workspace metadata', branchName);
  } catch (e) {
    const msg = getErrorMessage(e);
    logCmsServerError({
      operation: 'createBranch.metadata',
      branch: branchName,
      message: msg,
    });
    return { success: false, error: msg };
  }

  const prBodyLines = [
    `Content changes from the CMS editor.`,
    '',
    `Branch: \`${branchName}\``,
    ...(description ? ['', description] : []),
  ];
  const prBody = prBodyLines.join('\n');

  let prUrl = '';
  let prWarning: string | undefined;

  try {
    const pr = await createGitHubCMSPullRequest(branchName, workspaceTitle, prBody, baseBranch);
    prUrl = pr.url;
  } catch (e) {
    prWarning = getErrorMessage(e);
  }

  const cookieStore = await cookies();
  cookieStore.set(CMS_BRANCH_COOKIE, branchName, { path: '/' });

  // Pre-populate the content store for the new branch
  if (isProductionMode()) {
    warmBranch(branchName).catch(() => {
      /* best-effort */
    });
  }

  return prWarning ? { success: true, prUrl: '', prWarning } : { success: true, prUrl };
};

/**
 * Switch the active CMS branch to an existing branch (by PR).
 */
export const setActiveBranch = async (branchName: string): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.set(CMS_BRANCH_COOKIE, branchName, { path: '/' });

  // Pre-populate the content store so the first read after switching is instant
  if (isProductionMode()) {
    warmBranch(branchName).catch(() => {
      /* best-effort — first read will trigger a blocking fetch if this fails */
    });
  }
};

/**
 * Clear the active CMS branch, reverting listing/reads to `config.git.baseBranch`.
 */
export const clearBranch = async (): Promise<void> => {
  const cookieStore = await cookies();
  cookieStore.delete(CMS_BRANCH_COOKIE);
};

export type CMSBranch = {
  branch: string;
  prUrl: string;
  prNumber: number;
  title: string;
  isPublished: boolean;
};

/**
 * List CMS branches for the header: base branch plus **open** PRs labelled `cms-update`
 * (see `listGitHubCMSPullRequests`). Remote `cms/*` refs without an open labelled PR are omitted.
 */
export const listCMSBranches = async (): Promise<CMSBranch[]> => {
  try {
    const config = getConfig();
    const baseBranch = config.git.baseBranch;
    const pointerBranch = config.git.publishedPointerBranch?.trim();

    const [publishedBranch, prList] = await Promise.all([resolveContentBranch(), listGitHubCMSPullRequests()]);

    const base: CMSBranch = {
      branch: baseBranch,
      prUrl: '',
      prNumber: 0,
      title: baseBranch,
      isPublished: publishedBranch === baseBranch,
    };

    const features: CMSBranch[] = [];

    for (const pr of prList) {
      const branch = pr.branch.trim();
      if (!branch || branch === baseBranch) continue;
      if (pointerBranch && branch === pointerBranch) continue;
      if (!branch.startsWith('cms/')) continue;
      features.push({
        branch,
        prUrl: pr.prUrl,
        prNumber: pr.prNumber,
        title: pr.title.trim() || branch,
        isPublished: branch === publishedBranch,
      });
    }

    features.sort((a, b) => b.prNumber - a.prNumber);

    return [base, ...features];
  } catch (_e) {
    return [];
  }
};

/**
 * Publish a branch by writing `{ "branch": "<name>", "buildId": "<id>" }` into the per-build
 * pointer file (see {@link getPointerFilePath}) on the pointer branch when
 * `config.git.publishedPointerBranch` is set, otherwise on the base branch, invalidating all
 * public caches, and marking the associated PR as ready for review.
 *
 * Public pages will serve content from the published branch on the next request.
 */
export const publishBranch = async (branchName: string): Promise<ActionResult> => {
  try {
    const config = getConfig();
    const baseBranch = config.git.baseBranch;
    const pointerRef = getPublishedPointerRef();
    const targetBranch = pointerRef ?? baseBranch;
    const pointerPath = getPointerFilePath();
    const content = serializePointerPayload(branchName);

    await saveGitHubFile(pointerPath, content, `Publish branch ${branchName} (${pointerPath})`, targetBranch);
    await waitForPublicReadConsistency(pointerPath, content, targetBranch);
    await buildJsons('');

    if (branchName !== baseBranch) {
      try {
        await markPRReadyForReview(branchName);
      } catch (_e) {
        // PR marking is best-effort — don't fail publish if it errors
      }
    }

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed to publish branch: ${getErrorMessage(e)}`));
  }
};

/**
 * Fetch the last 5 commits that touched the given entry file for display in the
 * editor History panel. Production-only (dev mode writes to the local FS so there
 * is no GitHub history to show). Best-effort: any failure resolves to an empty
 * shape so the UI never throws.
 */
export const getEntryCommits = async (filePath: string): Promise<EntryCommitHistory> => {
  const empty: EntryCommitHistory = { commits: [], seeAllUrl: '' };

  if (!isProductionMode()) {
    return empty;
  }
  if (!filePath) {
    return empty;
  }

  try {
    const { owner, repo } = assertGitHubConfig();
    const [octokit] = getPublicOctokits();
    const baseBranch = getConfig().git.baseBranch;

    const { data } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      path: filePath,
      per_page: 5,
    });

    const commits: EntryCommit[] = data.slice(0, 5).map((c) => {
      const gitAuthor = c.commit.author;
      const committer = c.commit.committer;
      const ghAuthor = c.author;

      const message = (c.commit.message || '').split('\n', 1)[0];
      const login = ghAuthor?.login ?? null;
      const name = gitAuthor?.name || ghAuthor?.login || 'unknown';
      const avatarUrl = ghAuthor?.avatar_url ?? null;
      const committedAt = gitAuthor?.date || committer?.date || '';

      return {
        sha: c.sha,
        shortSha: c.sha.slice(0, 7),
        message,
        author: { login, name, avatarUrl },
        committedAt,
        url: c.html_url,
      };
    });

    const seeAllUrl = `https://github.com/${owner}/${repo}/commits/${encodeURIComponent(baseBranch)}/${encodeURI(filePath)}`;

    return { commits, seeAllUrl };
  } catch (e) {
    logCmsServerError({ operation: 'getEntryCommits', message: getErrorMessage(e) });
    return empty;
  }
};
