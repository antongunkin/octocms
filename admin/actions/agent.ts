'use server';

import { getAgentConfig } from '../../agent/configStore';
import { getAgentStatus, isAgentEnabled } from '../../agent/featureFlag';

export type AgentClientStatus =
  | { enabled: false }
  | {
      enabled: true;
      provider: 'anthropic' | 'openai' | 'local';
      model: string;
    };

/**
 * Server-side check exposed to the admin client (Header nav link).
 *
 * Never returns the API key. Returns `{ enabled: false }` when the chat is
 * disabled, so the client can hide the nav link without learning *why* —
 * mirroring the route-handler 404.
 */
export async function getAgentClientStatus(): Promise<AgentClientStatus> {
  const cfg = getAgentConfig();
  if (!cfg || !isAgentEnabled(cfg)) return { enabled: false };
  // Recompute via getAgentStatus so we exercise the same code path the route uses.
  const status = getAgentStatus(cfg);
  if (!status.enabled) return { enabled: false };
  return { enabled: true, provider: cfg.provider.type, model: cfg.provider.model };
}
