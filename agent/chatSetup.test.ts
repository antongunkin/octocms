import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildChatSetupInfo, CHAT_AGENT_DOCS_HREF, isChatAgentReady } from './chatSetup';
import type { AgentConfig } from './types';
import { recordTurn, resetUsage } from './usage';

const anthropicConfig: AgentConfig = {
  provider: { type: 'anthropic', model: 'claude-haiku-4-5-20251001' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 20,
  maxAttachmentBytes: 1,
  maxAttachmentsPerTurn: 1,
  totalBudgetUSD: 5,
};

const localConfig: AgentConfig = {
  provider: { type: 'local', model: 'llama', baseURL: 'http://localhost:11434/v1' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 20,
  maxAttachmentBytes: 1,
  maxAttachmentsPerTurn: 1,
  totalBudgetUSD: 0,
};

describe('isChatAgentReady', () => {
  it('returns false when agentConfig is missing', () => {
    expect(isChatAgentReady(undefined)).toBe(false);
  });

  it('returns false when the provider key is missing', () => {
    expect(isChatAgentReady(anthropicConfig)).toBe(false);
  });

  it('returns true for a configured local provider with baseURL', () => {
    expect(isChatAgentReady(localConfig)).toBe(true);
  });
});

describe('buildChatSetupInfo', () => {
  it('describes missing agentConfig export', () => {
    const setup = buildChatSetupInfo(undefined);
    expect(setup.reason).toBe('no-config');
    expect(setup.docsHref).toBe(CHAT_AGENT_DOCS_HREF);
    expect(setup.steps.some((s) => s.detail.includes('agentConfig'))).toBe(true);
  });

  it('describes missing credentials for hosted providers without env var names', () => {
    const setup = buildChatSetupInfo(anthropicConfig);
    expect(setup.reason).toBe('no-key');
    expect(setup.summary).toContain('Anthropic');
    expect(setup.summary).not.toMatch(/ANTHROPIC|OPENAI|_API_KEY/);
    expect(setup.steps.every((s) => !s.code?.includes('API_KEY'))).toBe(true);
  });

  it('describes a missing local endpoint without echoing URLs', () => {
    const cfg: AgentConfig = {
      ...localConfig,
      provider: { type: 'local', model: 'x' },
    };
    const setup = buildChatSetupInfo(cfg);
    expect(setup.reason).toBe('no-key');
    expect(setup.summary).toContain('endpoint');
    expect(setup.summary).not.toContain('http://');
  });

  it('throws when called for an enabled agent', () => {
    expect(() => buildChatSetupInfo(localConfig)).toThrow(/enabled/);
  });

  it('describes budget exhaustion', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-test');
    resetUsage();
    const cfg: AgentConfig = {
      ...anthropicConfig,
      totalBudgetUSD: 0.001,
      provider: {
        type: 'anthropic',
        model: 'claude-haiku-4-5-20251001',
        pricing: { inputPerM: 1, outputPerM: 5, cachedInputPerM: 0.1 },
      },
    };
    recordTurn(cfg, { input: 500, output: 500 });
    const setup = buildChatSetupInfo(cfg);
    expect(setup.reason).toBe('budget-exceeded');
    expect(setup.summary).toContain('spend cap');
    vi.unstubAllEnvs();
  });
});

afterEach(() => {
  resetUsage();
  vi.unstubAllEnvs();
});
