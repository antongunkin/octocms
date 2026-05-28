const trimOrEmpty = (value: string | undefined): string => (typeof value === 'string' ? value.trim() : '');

/** Session sealing secret (`NEXTAUTH_SECRET`). */
export function getSessionSecret(): string {
  const secret = trimOrEmpty(process.env.NEXTAUTH_SECRET);
  if (!secret) {
    throw new Error('Missing NEXTAUTH_SECRET. Generate one with: openssl rand -base64 32');
  }
  return secret;
}

/** Public app base URL for OAuth callback construction (`NEXTAUTH_URL`). */
export function getAppUrl(): string {
  const url =
    trimOrEmpty(process.env.NEXTAUTH_URL) || (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : '');

  if (!url) {
    throw new Error('Missing NEXTAUTH_URL — required in production for OAuth callbacks.');
  }

  return url.replace(/\/$/, '');
}

export function getOAuthCallbackUrl(): string {
  return `${getAppUrl()}/api/octocms/auth/callback`;
}
