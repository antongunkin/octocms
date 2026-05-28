import { cookies } from 'next/headers';

import { getSessionSecret } from './env';
import { sealSession, unsealSession } from './seal';
import type { CmsSession, CmsSessionPublic, CmsUser } from './types';
import {
  CMS_OAUTH_STATE_COOKIE,
  CMS_SESSION_COOKIE,
  formatClearCookie,
  formatSetCookie,
  oauthStateCookieOptions,
  sessionCookieOptions,
} from './cookies';

export type OAuthStatePayload = {
  state: string;
  returnTo: string;
};

export function toPublicSession(session: CmsSession): CmsSessionPublic {
  return { user: session.user };
}

/** Read and decrypt the CMS session from the request cookies (Server Components, Actions, Route Handlers). */
export async function getCmsSession(): Promise<CmsSession | null> {
  const cookieStore = await cookies();
  const sealed = cookieStore.get(CMS_SESSION_COOKIE)?.value;
  if (!sealed) return null;

  try {
    const secret = getSessionSecret();
    return unsealSession(sealed, secret);
  } catch {
    return null;
  }
}

export async function setCmsSessionCookie(session: CmsSession): Promise<string> {
  const secret = getSessionSecret();
  const sealed = await sealSession(session, secret);
  const cookieStore = await cookies();
  cookieStore.set(CMS_SESSION_COOKIE, sealed, sessionCookieOptions());
  return sealed;
}

export async function clearCmsSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CMS_SESSION_COOKIE);
}

export async function setOAuthStateCookie(payload: OAuthStatePayload): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(CMS_OAUTH_STATE_COOKIE, JSON.stringify(payload), oauthStateCookieOptions());
}

export async function readOAuthStateCookie(): Promise<OAuthStatePayload | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(CMS_OAUTH_STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthStatePayload;
    if (!parsed?.state) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearOAuthStateCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(CMS_OAUTH_STATE_COOKIE);
}

/** Build Set-Cookie headers for Route Handlers that return a raw `Response`. */
export async function buildSessionSetCookieHeader(session: CmsSession): Promise<string> {
  const secret = getSessionSecret();
  const sealed = await sealSession(session, secret);
  return formatSetCookie(CMS_SESSION_COOKIE, sealed, sessionCookieOptions());
}

export function buildSessionClearCookieHeader(): string {
  const opts = sessionCookieOptions();
  return formatClearCookie(CMS_SESSION_COOKIE, opts);
}

export function buildOAuthStateSetCookieHeader(payload: OAuthStatePayload): string {
  return formatSetCookie(CMS_OAUTH_STATE_COOKIE, JSON.stringify(payload), oauthStateCookieOptions());
}

export function buildOAuthStateClearCookieHeader(): string {
  const opts = oauthStateCookieOptions();
  return formatClearCookie(CMS_OAUTH_STATE_COOKIE, opts);
}

export const DEV_BYPASS_USER: CmsUser = {
  id: 'dev',
  name: 'Dev User',
  email: 'dev@local',
  image: null,
};

export function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_CMS_DEV_AUTH_BYPASS === '1';
}
