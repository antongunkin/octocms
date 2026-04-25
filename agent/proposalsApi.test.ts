/**
 * Tests for the package-level proposal Route Handlers
 * (`octocms/agent/proposalsApi.ts`). The user-app `route.ts` is just a
 * re-export, so these handler tests cover the whole stack.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../types';
import type { AgentConfig } from './types';

const minimalConfig: Config = {
  projectName: 'T',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: { title: { label: 'Title', format: 'string', required: true, entryTitle: true } },
    },
  },
} as unknown as Config;

const enabledAgentConfig: AgentConfig = {
  provider: { type: 'local', model: 'test', baseURL: 'http://x' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 3,
  maxAttachmentBytes: 100,
  maxAttachmentsPerTurn: 1,
  totalBudgetUSD: 0,
};

beforeEach(async () => {
  vi.resetModules();
  vi.doMock('../lib/configStore', () => ({
    getConfig: () => minimalConfig,
    setConfig: vi.fn(),
  }));
  // Auth: mock `next-auth/next` with a logged-in session. Individual tests can
  // override to return null for the unauth case.
  vi.doMock('next-auth/next', () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { name: 'Test' } }),
  }));
  vi.doMock('../admin/auth', () => ({ authOptions: {} }));
  // Reset usage so spend caps don't leak between tests.
  const u = await import('./usage');
  u.resetUsage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('isProposal', () => {
  it('accepts a well-formed edit proposal', async () => {
    const { isProposal } = await import('./proposalsApi');
    expect(
      isProposal({
        kind: 'edit',
        collection: 'post',
        entryPath: 'cms/content/post/post-a.json',
        fieldChanges: { title: 'X' },
      }),
    ).toBe(true);
  });

  it('accepts a well-formed create proposal', async () => {
    const { isProposal } = await import('./proposalsApi');
    expect(isProposal({ kind: 'create', collection: 'post', fields: { title: 'X' } })).toBe(true);
  });

  it('rejects bad shapes', async () => {
    const { isProposal } = await import('./proposalsApi');
    expect(isProposal(null)).toBe(false);
    expect(isProposal('string')).toBe(false);
    expect(isProposal({ kind: 'unknown', collection: 'post' })).toBe(false);
    expect(isProposal({ kind: 'edit', collection: 'post' })).toBe(false); // missing entryPath/fieldChanges
    expect(isProposal({ kind: 'create', collection: 'post' })).toBe(false); // missing fields
    expect(isProposal({ kind: 'edit', collection: '', entryPath: 'p', fieldChanges: {} })).toBe(false);
  });
});

describe('acceptProposalRoute', () => {
  it('404s when the agent feature is disabled', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => null, setAgentConfig: vi.fn() }));
    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(jsonRequest('http://test/accept', { proposal: {} }));
    expect(res.status).toBe(404);
  });

  it('401s when the user is not signed in', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(jsonRequest('http://test/accept', { proposal: {} }));
    expect(res.status).toBe(401);
  });

  it('400s when the body is not JSON', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(
      new Request('http://test/accept', { method: 'POST', body: 'not-json' }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/JSON/i);
  });

  it('400s when the body is missing a well-formed proposal', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(jsonRequest('http://test/accept', { proposal: { kind: 'huh' } }));
    expect(res.status).toBe(400);
  });

  it('runs acceptProposal and returns the saved entry path on success', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const saveFile = vi.fn().mockResolvedValue({ success: true });
    const getFile = vi
      .fn()
      .mockResolvedValue({ sys: { id: 'a', type: 'post', status: 'merged' }, fields: { title: 'Old' } });
    vi.doMock('../admin/actions/files', () => ({ saveFile, newFile: vi.fn(), getFile, getContentFiles: vi.fn() }));

    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(
      jsonRequest('http://test/accept', {
        proposal: {
          id: 'p1',
          kind: 'edit',
          toolUseId: 'tu',
          collection: 'post',
          entryPath: 'cms/content/post/post-a.json',
          entryId: 'post-a',
          fieldChanges: { title: 'New' },
          reasoning: 'r',
          summary: 's',
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, entryPath: 'cms/content/post/post-a.json' });
    expect(saveFile).toHaveBeenCalledTimes(1);
  });

  it('returns 400 + fieldErrors when saveFile rejects the change', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    vi.doMock('../admin/actions/files', () => ({
      saveFile: vi.fn().mockResolvedValue({
        success: false,
        error: 'Title is required',
        fieldErrors: { title: 'Title is required' },
      }),
      newFile: vi.fn(),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'a', type: 'post' }, fields: { title: 'x' } }),
      getContentFiles: vi.fn(),
    }));

    const { acceptProposalRoute } = await import('./proposalsApi');
    const res = await acceptProposalRoute(
      jsonRequest('http://test/accept', {
        proposal: {
          id: 'p1',
          kind: 'edit',
          toolUseId: 'tu',
          collection: 'post',
          entryPath: 'cms/content/post/post-a.json',
          entryId: 'post-a',
          fieldChanges: { title: '' },
          reasoning: 'r',
          summary: 's',
        },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Title is required');
    expect(body.fieldErrors).toEqual({ title: 'Title is required' });
  });
});

describe('rejectProposalRoute', () => {
  it('404s when the agent feature is disabled', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => null, setAgentConfig: vi.fn() }));
    const { rejectProposalRoute } = await import('./proposalsApi');
    const res = await rejectProposalRoute(jsonRequest('http://test/reject', { reason: 'x' }));
    expect(res.status).toBe(404);
  });

  it('401s when not signed in', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { rejectProposalRoute } = await import('./proposalsApi');
    const res = await rejectProposalRoute(jsonRequest('http://test/reject', { reason: 'x' }));
    expect(res.status).toBe(401);
  });

  it('returns 200 ok with a JSON body even when no reason is sent', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { rejectProposalRoute } = await import('./proposalsApi');
    const res = await rejectProposalRoute(jsonRequest('http://test/reject', {}));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('still 200s when the request body is malformed', async () => {
    vi.doMock('./configStore', () => ({ getAgentConfig: () => enabledAgentConfig, setAgentConfig: vi.fn() }));
    const { rejectProposalRoute } = await import('./proposalsApi');
    const res = await rejectProposalRoute(new Request('http://test/reject', { method: 'POST', body: 'not-json' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
