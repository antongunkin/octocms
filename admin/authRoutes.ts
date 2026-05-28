import { OCTOCMS_API } from '../lib/octocmsApiRoutes';

import { getOAuthCallbackUrl, getAppUrl } from './auth/env';
import { getAuthorizationUrl, exchangeCodeForSession } from './auth/oauthApp';
import {
  buildOAuthStateClearCookieHeader,
  buildOAuthStateSetCookieHeader,
  buildSessionClearCookieHeader,
  buildSessionSetCookieHeader,
  clearOAuthStateCookie,
  clearCmsSessionCookie,
  readOAuthStateCookie,
  toPublicSession,
} from './auth/session';
import type { CmsUser } from './auth/types';

export type AuthorizeUserFn = (user: CmsUser) => boolean | Promise<boolean>;

export type AuthRouteHandlers = {
  authRoute: (request: Request, action: string) => Promise<Response>;
};

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function absoluteReturnTo(path: string): string {
  const safe = sanitizeReturnTo(path);
  if (safe.startsWith('http://') || safe.startsWith('https://')) return safe;
  return `${getAppUrl()}${safe}`;
}

function absoluteAuthLoginUrl(query?: string): string {
  const base = `${getAppUrl()}${OCTOCMS_API.auth.login}`;
  return query ? `${base}?${query}` : base;
}

function sanitizeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/cms';
  }
  return value;
}

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
}

function appendCookies(response: Response, ...cookieHeaders: string[]): Response {
  if (cookieHeaders.length === 0) return response;
  const headers = new Headers(response.headers);
  for (const cookie of cookieHeaders) {
    headers.append('Set-Cookie', cookie);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleLogin(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const returnTo = sanitizeReturnTo(url.searchParams.get('returnTo'));
  const state = randomState();

  const oauthStateCookie = buildOAuthStateSetCookieHeader({ state, returnTo });
  const authUrl = getAuthorizationUrl(state, getOAuthCallbackUrl());

  return appendCookies(Response.redirect(authUrl, 302), oauthStateCookie);
}

async function handleCallback(request: Request, authorizeUser?: AuthorizeUserFn): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const stateParam = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return appendCookies(
      Response.redirect(absoluteAuthLoginUrl(`error=${encodeURIComponent(error)}`), 302),
      buildOAuthStateClearCookieHeader(),
    );
  }

  if (!code || !stateParam) {
    return jsonResponse({ error: 'Missing code or state.' }, { status: 400 });
  }

  const stored = await readOAuthStateCookie();
  if (!stored || stored.state !== stateParam) {
    return jsonResponse({ error: 'Invalid OAuth state.' }, { status: 400 });
  }

  try {
    const session = await exchangeCodeForSession(code);

    if (authorizeUser) {
      const allowed = await authorizeUser(session.user);
      if (!allowed) {
        return appendCookies(
          Response.redirect(absoluteAuthLoginUrl('error=access_denied'), 302),
          buildOAuthStateClearCookieHeader(),
          buildSessionClearCookieHeader(),
        );
      }
    }

    const sessionCookie = await buildSessionSetCookieHeader(session);
    await clearOAuthStateCookie();

    return appendCookies(
      Response.redirect(absoluteReturnTo(stored.returnTo), 302),
      sessionCookie,
      buildOAuthStateClearCookieHeader(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'OAuth callback failed.';
    return appendCookies(
      Response.redirect(absoluteAuthLoginUrl(`error=${encodeURIComponent(message)}`), 302),
      buildOAuthStateClearCookieHeader(),
    );
  }
}

async function handleLogout(): Promise<Response> {
  await clearCmsSessionCookie();
  return appendCookies(jsonResponse({ ok: true }), buildSessionClearCookieHeader());
}

async function handleSession(): Promise<Response> {
  const { getCmsSession } = await import('./auth/session');
  const session = await getCmsSession();
  if (!session) {
    return jsonResponse({ error: 'Unauthorized' }, { status: 401 });
  }
  return jsonResponse(toPublicSession(session));
}

/**
 * Factory for auth Route Handlers with optional access-control hook.
 */
export function createAuthRouteHandlers(options?: { authorizeUser?: AuthorizeUserFn }): AuthRouteHandlers {
  const { authorizeUser } = options ?? {};

  async function authRoute(request: Request, action: string): Promise<Response> {
    const method = request.method.toUpperCase();

    switch (action) {
      case 'login':
        if (method !== 'GET') return new Response(null, { status: 405 });
        return handleLogin(request);
      case 'callback':
        if (method !== 'GET') return new Response(null, { status: 405 });
        return handleCallback(request, authorizeUser);
      case 'logout':
        if (method !== 'POST') return new Response(null, { status: 405 });
        return handleLogout();
      case 'session':
        if (method !== 'GET') return new Response(null, { status: 405 });
        return handleSession();
      default:
        return new Response(null, { status: 404 });
    }
  }

  return { authRoute };
}

/** Default auth Route Handler dispatcher (no access-control hook). */
export const { authRoute } = createAuthRouteHandlers();
