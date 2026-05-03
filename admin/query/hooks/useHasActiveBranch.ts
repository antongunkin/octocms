'use client';

import { hasActiveBranch } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Whether a feature branch cookie is currently set. Tier `realtime`: same
 * cookie that drives `useBranch`.
 */
export function useHasActiveBranch() {
  return useAdminQuery({
    queryKey: queryKeys.git.hasActive(),
    queryFn: () => hasActiveBranch(),
    tier: 'realtime',
  });
}
