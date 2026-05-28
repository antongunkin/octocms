export const CMS_SESSION_COOKIE = 'octocms-session';
export const CMS_OAUTH_STATE_COOKIE = 'octocms-oauth-state';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days — parity with typical OAuth sessions
const OAUTH_STATE_MAX_AGE_SECONDS = 5 * 60;

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge?: number;
};

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function oauthStateCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

/** Serialize cookie for `Set-Cookie` header (Route Handler responses). */
export function formatSetCookie(name: string, value: string, options: CookieOptions): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${options.path}`, `SameSite=${options.sameSite}`];
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join('; ');
}

/** Clear cookie via `Set-Cookie` with Max-Age=0. */
export function formatClearCookie(name: string, options: Pick<CookieOptions, 'path' | 'secure' | 'sameSite'>): string {
  const parts = [`${name}=`, `Path=${options.path}`, 'Max-Age=0', `SameSite=${options.sameSite}`];
  parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}
