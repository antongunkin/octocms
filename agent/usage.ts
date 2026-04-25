/**
 * Cumulative spend tracker for the chat agent.
 *
 * In-memory and per-process: every Vercel function instance owns its own
 * counter, and it resets on cold start. This is intentionally lightweight —
 * the goal is "best-effort cutoff so a runaway loop doesn't burn the dev
 * credit", not a hard accounting guarantee. For a hard cap, set a workspace
 * budget alert in your provider's console alongside `config.totalBudgetUSD`.
 *
 * Phase 3 (chat route) calls {@link recordTurn} after each provider response.
 */

import { estimateCostUSD } from './pricing';
import type { AgentConfig } from './types';

export type AgentUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUSD: number;
  lastUpdated: string | null;
};

const ZERO: AgentUsage = {
  inputTokens: 0,
  cachedInputTokens: 0,
  outputTokens: 0,
  costUSD: 0,
  lastUpdated: null,
};

let state: AgentUsage = { ...ZERO };

export function getUsage(): AgentUsage {
  return { ...state };
}

export function recordTurn(
  config: AgentConfig,
  turn: { input: number; output: number; cachedInput?: number },
): AgentUsage {
  const cachedInput = turn.cachedInput ?? 0;
  state = {
    inputTokens: state.inputTokens + turn.input,
    cachedInputTokens: state.cachedInputTokens + cachedInput,
    outputTokens: state.outputTokens + turn.output,
    costUSD: state.costUSD + estimateCostUSD(config, turn.input, turn.output, cachedInput),
    lastUpdated: new Date().toISOString(),
  };
  return getUsage();
}

export function resetUsage(): AgentUsage {
  state = { ...ZERO };
  return getUsage();
}

/**
 * Whether cumulative spend has crossed `config.totalBudgetUSD`.
 * `totalBudgetUSD <= 0` disables the cap entirely (useful for local providers).
 */
export function isBudgetExceeded(config: AgentConfig, usage: AgentUsage = state): boolean {
  if (config.totalBudgetUSD <= 0) return false;
  return usage.costUSD >= config.totalBudgetUSD;
}
