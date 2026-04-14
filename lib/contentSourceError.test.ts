import { describe, expect, it } from 'vitest';

import {
  ContentSourceError,
  isContentSourceError,
  mapGitHubApiErrorToContentSource,
  parseContentSourceFromMessage,
} from './contentSourceError';

const ctx = { owner: 'acme', repo: 'cms', ref: 'main' };

describe('ContentSourceError', () => {
  it('sets name, code, userMessage, and a prefixed message', () => {
    const err = new ContentSourceError('github_config', 'Not configured');
    expect(err.name).toBe('ContentSourceError');
    expect(err.code).toBe('github_config');
    expect(err.userMessage).toBe('Not configured');
    expect(err.message).toBe('CMS_PUBLIC:github_config:Not configured');
  });

  it('isContentSourceError identifies instances', () => {
    expect(isContentSourceError(new ContentSourceError('github_auth', 'x'))).toBe(true);
    expect(isContentSourceError(new Error('x'))).toBe(false);
  });
});

describe('parseContentSourceFromMessage', () => {
  it('parses a serialized ContentSourceError message', () => {
    const err = new ContentSourceError('github_unavailable', 'Try later');
    expect(parseContentSourceFromMessage(err.message)).toEqual({
      code: 'github_unavailable',
      userMessage: 'Try later',
    });
  });

  it('returns null for unrelated messages', () => {
    expect(parseContentSourceFromMessage('plain error')).toBeNull();
    expect(parseContentSourceFromMessage('CMS_PUBLIC:unknown:x')).toBeNull();
  });
});

describe('mapGitHubApiErrorToContentSource', () => {
  it('maps 429 to github_rate_limit', () => {
    const mapped = mapGitHubApiErrorToContentSource({ status: 429, message: 'rate limit' }, ctx);
    expect(mapped.code).toBe('github_rate_limit');
    expect(mapped.userMessage).toMatch(/rate limit/i);
  });

  it('maps 403 to github_auth', () => {
    const mapped = mapGitHubApiErrorToContentSource({ status: 403, message: 'Forbidden' }, ctx);
    expect(mapped.code).toBe('github_auth');
    expect(mapped.userMessage).toMatch(/GitHub/);
  });

  it('maps 5xx to github_unavailable', () => {
    const mapped = mapGitHubApiErrorToContentSource({ status: 502, message: 'Bad Gateway' }, ctx);
    expect(mapped.code).toBe('github_unavailable');
  });

  it('maps 404 to github_auth with ref hint', () => {
    const mapped = mapGitHubApiErrorToContentSource({ status: 404, message: 'Not Found' }, ctx);
    expect(mapped.code).toBe('github_auth');
    expect(mapped.userMessage).toMatch(/main/);
  });

  it('maps fetch failed to github_unavailable', () => {
    const mapped = mapGitHubApiErrorToContentSource(new Error('fetch failed'), ctx);
    expect(mapped.code).toBe('github_unavailable');
  });
});
