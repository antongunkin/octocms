/**
 * True when public content reads use the GitHub API (`NODE_ENV=production` or `CMS_FORCE_GITHUB_API=true`).
 * Shared by env validation (including `next.config.ts`) and `@/app/cms/github` / `cms/query`.
 */
export function isProductionMode(): boolean {
  if (process.env.CMS_FORCE_GITHUB_API === 'true') {
    return true;
  }

  return process.env.NODE_ENV === 'production';
}
