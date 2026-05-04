const trim = (value: string | undefined): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Optional default branch from env (per deploy). If set but the branch does not exist on GitHub,
 * callers fall back to `config.git.baseBranch`.
 */
export function getCmsBranchEnv(): string | undefined {
  const v = trim(process.env.CMS_BRANCH);
  return v || undefined;
}

/**
 * Build / deployment id for the per-build pointer filename under `cms/pointers/`.
 *
 * Typical sources: `VERCEL_DEPLOYMENT_ID`, `VERCEL_BUILD_ID`, `GITHUB_RUN_ID`, or `BUILD_ID`.
 * Falls back to `local` when unset (local dev and non-Vercel hosts should set `BUILD_ID` if multiple
 * deploys share one repo and need separate pointers).
 */
export function getBuildId(): string {
  const raw =
    trim(process.env.VERCEL_DEPLOYMENT_ID) ||
    trim(process.env.VERCEL_BUILD_ID) ||
    trim(process.env.GITHUB_RUN_ID) ||
    trim(process.env.BUILD_ID) ||
    '';
  const id = raw.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^\.+/, '');
  return id || 'local';
}

/** True when the editor-selected branch matches public default (`baseBranch` or `CMS_BRANCH`). */
export function isDefaultPublicEditorBranch(branch: string, baseBranch: string): boolean {
  const b = trim(branch);
  if (!b) return true;
  if (b === trim(baseBranch)) return true;
  const envDefault = getCmsBranchEnv();
  if (envDefault && b === trim(envDefault)) return true;
  return false;
}

/** Serialized pointer JSON written to Git (includes `buildId` for traceability). */
export function serializePointerPayload(branch: string): string {
  return `${JSON.stringify({ branch, buildId: getBuildId() }, null, 2)}\n`;
}

/** Repo-relative path to the per-build pointer JSON on the pointer ref (or base branch). */
export function getPointerFilePath(): string {
  const id =
    getBuildId()
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^\.+/, '') || 'local';
  return `cms/pointers/${id}.json`;
}
