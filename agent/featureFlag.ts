/**
 * Server-side check for whether the RAG chat agent feature is enabled.
 *
 * The agent is enabled when:
 *   1. The provider's API key env var is set (Anthropic / OpenAI), OR the
 *      provider is `'local'` and a `baseURL` is configured (no key required), AND
 *   2. cumulative spend on this deploy is under `config.totalBudgetUSD`
 *      (cap is bypassed when `totalBudgetUSD <= 0`).
 *
 * When either check fails, `/cms/chat` renders an in-page setup guide and chat
 * API routes return 404. Do not call from client components to gate UI — the
 * server page passes setup props instead of leaking the key.
 *
 * Note: this does NOT check whether the SDK packages are installed. They are
 * optional peer deps; their absence surfaces at chat-route invocation time
 * with a clear error rather than silently disabling the feature.
 */

import type { AgentConfig, AgentProvider } from './types';
import { getUsage, isBudgetExceeded } from './usage';

export type AgentStatus =
  | { enabled: true }
  | { enabled: false; reason: 'no-key' }
  | { enabled: false; reason: 'budget-exceeded'; spentUSD: number; budgetUSD: number };

const DEFAULT_API_KEY_ENVS: Record<AgentProvider['type'], string | null> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  local: null,
};

/** Resolves the env var name a provider reads its API key from. */
export function providerApiKeyEnv(provider: AgentProvider): string | null {
  if (provider.apiKeyEnv) return provider.apiKeyEnv;
  return DEFAULT_API_KEY_ENVS[provider.type];
}

/** True iff the provider has the credentials it needs to talk to its model. */
export function hasProviderKey(provider: AgentProvider): boolean {
  if (provider.type === 'local') {
    if (provider.apiKeyEnv) {
      const key = process.env[provider.apiKeyEnv];
      return typeof key === 'string' && key.length > 0;
    }
    return Boolean(provider.baseURL);
  }
  const envName = providerApiKeyEnv(provider);
  if (!envName) return false;
  const key = process.env[envName];
  return typeof key === 'string' && key.length > 0;
}

export function getAgentStatus(config: AgentConfig): AgentStatus {
  if (!hasProviderKey(config.provider)) return { enabled: false, reason: 'no-key' };
  const usage = getUsage();
  if (isBudgetExceeded(config, usage)) {
    return {
      enabled: false,
      reason: 'budget-exceeded',
      spentUSD: usage.costUSD,
      budgetUSD: config.totalBudgetUSD,
    };
  }
  return { enabled: true };
}

export function isAgentEnabled(config: AgentConfig): boolean {
  return getAgentStatus(config).enabled;
}
