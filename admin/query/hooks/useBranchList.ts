'use client';

import { listCMSBranches } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * List of CMS feature branches with publish state. Lazy: pass `enabled: false`
 * until the branch dropdown opens — there's no point fetching the list during
 * normal navigation. Tier `realtime` because branch state can change from
 * outside the CMS (PR merges, force pushes).
 */
export function useBranchList(options: { enabled?: boolean } = {}) {
  return useAdminQuery({
    queryKey: queryKeys.git.branches(),
    queryFn: () => listCMSBranches(),
    tier: 'realtime',
    enabled: options.enabled ?? true,
  });
}
