import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authRoute } from './authRoutes';
import { CMS_SESSION_COOKIE, CMS_OAUTH_STATE_COOKIE } from './auth/cookies';

const mockExchange = vi.fn();
const mockGetAuthUrl = vi.fn(() => 'https://github.com/login/oauth/authorize?client_id=test');

vi.mock('./auth/oauthApp', () => ({
  getAuthorizationUrl: () => mockGetAuthUrl(),
  exchangeCodeForSession: (...args: unknown[]) => mockExchange(...args),
}));

vi.mock('./auth/env', () => ({
  getOAuthCallbackUrl: () => 'http://localhost:3000/api/octocms/auth/callback',
  getSessionSecret: () => 'test-secret-at-least-32-characters-long!!',
  getAppUrl: () => 'http://localhost:3000',
}));

const cookieStore = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => {
      const value = cookieStore.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

function parseSetCookies(response: Response): string[] {
  return response.headers.getSetCookie?.() ?? [];
}

describe('authRoute', () => {
  beforeEach(() => {
    cookieStore.clear();
    mockExchange.mockReset();
    mockGetAuthUrl.mockClear();
    vi.stubEnv('NODE_ENV', 'development');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('login redirects to GitHub and sets oauth state cookie', async () => {
    const res = await authRoute(new Request('http://localhost/api/octocms/auth/login?returnTo=/cms'), 'login');
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/^https:\/\/github\.com/);
    const setCookies = parseSetCookies(res);
    expect(setCookies.some((c) => c.startsWith(`${CMS_OAUTH_STATE_COOKIE}=`))).toBe(true);
    expect(mockGetAuthUrl).toHaveBeenCalled();
  });

  it('callback exchanges code and sets session cookie', async () => {
    cookieStore.set(CMS_OAUTH_STATE_COOKIE, JSON.stringify({ state: 'abc', returnTo: '/cms' }));
    mockExchange.mockResolvedValue({
      user: { id: '1', name: 'Tester' },
      accessToken: 'tok',
    });

    const res = await authRoute(
      new Request('http://localhost/api/octocms/auth/callback?code=xyz&state=abc'),
      'callback',
    );
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toBe('http://localhost:3000/cms');
    const setCookies = parseSetCookies(res);
    expect(setCookies.some((c) => c.startsWith(`${CMS_SESSION_COOKIE}=`))).toBe(true);
  });

  it('callback rejects invalid state', async () => {
    cookieStore.set(CMS_OAUTH_STATE_COOKIE, JSON.stringify({ state: 'abc', returnTo: '/cms' }));
    const res = await authRoute(
      new Request('http://localhost/api/octocms/auth/callback?code=xyz&state=wrong'),
      'callback',
    );
    expect(res.status).toBe(400);
  });

  it('session returns 401 when unauthenticated', async () => {
    const res = await authRoute(new Request('http://localhost/api/octocms/auth/session'), 'session');
    expect(res.status).toBe(401);
  });

  it('logout clears session cookie', async () => {
    cookieStore.set(CMS_SESSION_COOKIE, 'sealed-value');
    const res = await authRoute(new Request('http://localhost/api/octocms/auth/logout', { method: 'POST' }), 'logout');
    expect(res.status).toBe(200);
    expect(cookieStore.has(CMS_SESSION_COOKIE)).toBe(false);
  });
});
