'use client';

import { getAgentClientStatus } from '../../actions/agent';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Whether the chat agent is enabled for this deploy. Tier `static` because
 * agent enablement is fixed for the lifetime of the JS bundle (env var driven).
 */
export function useAgentStatus() {
  return useAdminQuery({
    queryKey: queryKeys.agent.status(),
    queryFn: () => getAgentClientStatus(),
    tier: 'static',
  });
}
