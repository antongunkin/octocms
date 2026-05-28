import { OAuthApp } from '@octokit/oauth-app';
import { Octokit } from 'octokit';

import type { CmsSession, CmsUser } from './types';

let oauthAppSingleton: InstanceType<typeof OAuthApp> | null = null;

function getClientId(): string {
  const id = process.env.GITHUB_ID?.trim();
  if (!id) throw new Error('Missing GITHUB_ID environment variable.');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GITHUB_SECRET?.trim();
  if (!secret) throw new Error('Missing GITHUB_SECRET environment variable.');
  return secret;
}

export function getOAuthApp(): InstanceType<typeof OAuthApp> {
  if (!oauthAppSingleton) {
    oauthAppSingleton = new OAuthApp({
      clientType: 'github-app',
      clientId: getClientId(),
      clientSecret: getClientSecret(),
    });
  }
  return oauthAppSingleton;
}

/** Reset singleton — test seam only. */
export function resetOAuthAppForTests(): void {
  oauthAppSingleton = null;
}

export function getAuthorizationUrl(state: string, redirectUrl: string): string {
  const app = getOAuthApp();
  const { url } = app.getWebFlowAuthorizationUrl({
    state,
    redirectUrl,
    // GitHub Apps use app permissions — scopes are ignored for github-app client type.
    scopes: ['repo'],
  });
  return url;
}

export async function exchangeCodeForSession(code: string): Promise<CmsSession> {
  const app = getOAuthApp();
  const { authentication } = await app.createToken({ code });

  const accessToken = authentication.token;
  if (!accessToken) {
    throw new Error('GitHub did not return an access token.');
  }

  const octokit = new Octokit({ auth: accessToken });
  const { data } = await octokit.rest.users.getAuthenticated();

  const user: CmsUser = {
    id: String(data.id),
    name: data.name ?? data.login,
    email: data.email,
    image: data.avatar_url,
  };

  return { user, accessToken };
}
