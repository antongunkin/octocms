import { isProductionMode } from './githubContentMode';

const trimOrEmpty = (value: string | undefined): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Returns env var names that are missing or blank for the current process mode.
 * In non-production, returns an empty array.
 */
export function getProductionEnvIssues(): string[] {
  if (process.env.NODE_ENV !== 'production') {
    return [];
  }

  const missing: string[] = [];

  if (!trimOrEmpty(process.env.NEXTAUTH_SECRET)) missing.push('NEXTAUTH_SECRET');
  if (!trimOrEmpty(process.env.GITHUB_ID)) missing.push('GITHUB_ID');
  if (!trimOrEmpty(process.env.GITHUB_SECRET)) missing.push('GITHUB_SECRET');
  if (!trimOrEmpty(process.env.NEXTAUTH_URL)) missing.push('NEXTAUTH_URL');

  if (isProductionMode()) {
    if (!trimOrEmpty(process.env.GITHUB_REPO_OWNER)) missing.push('GITHUB_REPO_OWNER');
    if (!trimOrEmpty(process.env.GITHUB_REPO_NAME)) missing.push('GITHUB_REPO_NAME');
  }

  return missing;
}

export function assertProductionEnvOrThrow(): void {
  const missing = getProductionEnvIssues();
  if (missing.length === 0) return;

  throw new Error(
    `Missing required environment variables for production: ${missing.join(', ')}. ` +
      'See README.md (Production requirements) and docs/deployment-errors.md.',
  );
}
