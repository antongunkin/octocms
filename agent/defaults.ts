import type { AgentConfig } from './types';

/**
 * Defaults for {@link AgentConfig}. Targets Claude Haiku 4.5 — cheapest
 * current Claude tier with full tool-use support — and a $5 spend cap that
 * comfortably covers evaluation and developer testing.
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  provider: {
    type: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    pricing: { inputPerM: 1, outputPerM: 5, cachedInputPerM: 0.1 },
  },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 20,
  maxAttachmentBytes: 25 * 1024 * 1024,
  maxAttachmentsPerTurn: 3,
  totalBudgetUSD: 5,
};

/**
 * Helper for the user's `cms/octocms.config.ts`. Merges shallow overrides
 * into {@link DEFAULT_AGENT_CONFIG} so users only specify what they want to
 * change. The `provider` field is replaced wholesale (it's a discriminated
 * union — shallow-merging across `'anthropic'` / `'openai'` / `'local'`
 * variants would produce invalid combinations).
 */
export function defineAgentConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    ...DEFAULT_AGENT_CONFIG,
    ...overrides,
    provider: overrides.provider ?? DEFAULT_AGENT_CONFIG.provider,
  };
}
