const trimOrEmpty = (value: string | undefined): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Session sealing secret. Prefer `CMS_SESSION_SECRET`; falls back to legacy `NEXTAUTH_SECRET`.
 */
export function getSessionSecret(): string {
  const secret = trimOrEmpty(process.env.CMS_SESSION_SECRET) || trimOrEmpty(process.env.NEXTAUTH_SECRET);
  if (!secret) {
    throw new Error(
      'Missing CMS_SESSION_SECRET (or legacy NEXTAUTH_SECRET). Generate one with: openssl rand -base64 32',
    );
  }
  return secret;
}

/**
 * Public app base URL for OAuth callback construction. Prefer `CMS_APP_URL`; falls back to `NEXTAUTH_URL`.
 */
export function getAppUrl(): string {
  const url =
    trimOrEmpty(process.env.CMS_APP_URL) ||
    trimOrEmpty(process.env.NEXTAUTH_URL) ||
    (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');

  if (!url) {
    throw new Error('Missing CMS_APP_URL (or legacy NEXTAUTH_URL) — required in production for OAuth callbacks.');
  }

  return url.replace(/\/$/, '');
}

export function getOAuthCallbackUrl(): string {
  return `${getAppUrl()}/api/octocms/auth/callback`;
}
