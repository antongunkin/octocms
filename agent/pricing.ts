import type { AgentConfig, AgentProvider } from './types';

/** Returns provider pricing if defined, otherwise `null` (treated as $0). */
export function getProviderPricing(provider: AgentProvider) {
  return provider.pricing ?? null;
}

/**
 * Estimated USD cost of a turn against `config.provider.pricing`.
 * `cachedInput` is the subset of `input` tokens served from the prompt cache
 * (billed at the cached rate). Returns `0` for providers without pricing
 * (typically local models).
 */
export function estimateCostUSD(config: AgentConfig, input: number, output: number, cachedInput = 0): number {
  const pricing = getProviderPricing(config.provider);
  if (!pricing) return 0;
  const fresh = Math.max(0, input - cachedInput);
  return (
    (fresh * pricing.inputPerM) / 1_000_000 +
    (cachedInput * pricing.cachedInputPerM) / 1_000_000 +
    (output * pricing.outputPerM) / 1_000_000
  );
}
