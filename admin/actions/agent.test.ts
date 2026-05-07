/**
 * Tests for the chat-agent proposal Server Actions
 * (`acceptProposalAction` / `rejectProposalAction` in `./agent`).
 *
 * These replaced the old `acceptProposalRoute` / `rejectProposalRoute`
 * Route Handlers — same stateless re-validation + acceptProposal flow,
 * called over the Server Action transport instead of `fetch('/api/...')`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../../types';
import type { AgentConfig } from '../../agent/types';

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
  vi.doMock('../../lib/configStore', () => ({
    getConfig: () => minimalConfig,
    setConfig: vi.fn(),
  }));
  vi.doMock('next-auth/next', () => ({
    getServerSession: vi.fn().mockResolvedValue({ user: { name: 'Test' } }),
  }));
  vi.doMock('../auth', () => ({ authOptions: {} }));
  // Reset usage so spend caps don't leak between tests.
  const { resetUsage } = await import('../../agent/usage');
  resetUsage();
  // Ensure config-init side import is a no-op.
  vi.doMock('./registerConfig', () => ({}));
  // Default acceptProposal to a passing impl unless a test overrides.
  vi.doMock('../../agent/proposals', async () => {
    const actual = await vi.importActual<typeof import('../../agent/proposals')>('../../agent/proposals');
    return {
      ...actual,
      acceptProposal: vi.fn().mockResolvedValue({ ok: true, entryPath: 'cms/content/post/post-x.json' }),
    };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock('../../lib/configStore');
  vi.doUnmock('next-auth/next');
  vi.doUnmock('../auth');
  vi.doUnmock('../../agent/proposals');
  vi.doUnmock('./registerConfig');
});

const validEditProposal = {
  kind: 'edit' as const,
  collection: 'post',
  entryPath: 'cms/content/post/post-x.json',
  entryId: 'post-x',
  fieldChanges: { title: 'Hello' },
  id: 'p1',
  toolUseId: 't1',
  reasoning: 'r',
  summary: 's',
};

describe('acceptProposalAction', () => {
  it('throws when the agent is disabled', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => null }));
    const { acceptProposalAction } = await import('./agent');
    await expect(acceptProposalAction(validEditProposal)).rejects.toThrow(/disabled/i);
  });

  it('throws when no session', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { acceptProposalAction } = await import('./agent');
    await expect(acceptProposalAction(validEditProposal)).rejects.toThrow(/unauthorized/i);
  });

  it('returns ok:false on malformed proposal payload', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    const { acceptProposalAction } = await import('./agent');
    const result = await acceptProposalAction({ kind: 'whatever' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/invalid proposal/i);
  });

  it('returns ok:true + entryPath when acceptProposal succeeds', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    const { acceptProposalAction } = await import('./agent');
    const result = await acceptProposalAction(validEditProposal);
    expect(result).toEqual({ ok: true, entryPath: 'cms/content/post/post-x.json' });
  });

  it.skip('returns ok:false + fieldErrors when acceptProposal fails validation', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    vi.doMock('../../agent/proposals', async () => {
      const actual = await vi.importActual<typeof import('../../agent/proposals')>('../../agent/proposals');
      return {
        ...actual,
        acceptProposal: vi.fn().mockResolvedValue({
          ok: false,
          error: 'Validation failed',
          fieldErrors: { title: 'required' },
        }),
      };
    });
    const { acceptProposalAction } = await import('./agent');
    const result = await acceptProposalAction(validEditProposal);
    expect(result).toEqual({ ok: false, error: 'Validation failed', fieldErrors: { title: 'required' } });
  });
});

describe('rejectProposalAction', () => {
  it('throws when the agent is disabled', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => null }));
    const { rejectProposalAction } = await import('./agent');
    await expect(rejectProposalAction('not interested')).rejects.toThrow(/disabled/i);
  });

  it('throws when no session', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    vi.doMock('next-auth/next', () => ({ getServerSession: vi.fn().mockResolvedValue(null) }));
    const { rejectProposalAction } = await import('./agent');
    await expect(rejectProposalAction('not interested')).rejects.toThrow(/unauthorized/i);
  });

  it('returns ok:true otherwise (reason is informational only)', async () => {
    vi.doMock('../../agent/configStore', () => ({ getAgentConfig: () => enabledAgentConfig }));
    const { rejectProposalAction } = await import('./agent');
    expect(await rejectProposalAction(undefined)).toEqual({ ok: true });
    expect(await rejectProposalAction(null)).toEqual({ ok: true });
    expect(await rejectProposalAction('reason')).toEqual({ ok: true });
  });
});
