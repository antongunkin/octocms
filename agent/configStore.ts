/**
 * Singleton holder for the chat agent's `AgentConfig`.
 *
 * Mirrors `octocms/lib/configStore` for the regular `Config`. Populated by
 * the auto-generated `cms/__generated__/configInit.ts` so server actions can
 * read the agent config without importing the user's `cms/octocms.config.ts`
 * directly (architecture rule: no `octocms/` file imports user-app files).
 *
 * Returns `null` from `getAgentConfig()` when the user hasn't exported an
 * `agentConfig` — the chat feature stays cleanly opt-in.
 */

import type { AgentConfig } from './types';

let _agentConfig: AgentConfig | null = null;

export function setAgentConfig(config: AgentConfig): void {
  _agentConfig = config;
}

export function getAgentConfig(): AgentConfig | null {
  return _agentConfig;
}
