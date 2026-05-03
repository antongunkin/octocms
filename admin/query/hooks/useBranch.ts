'use client';

import { getBranch } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Active feature branch name (or base branch when no `cms-active-branch`
 * cookie is set). Tier `realtime` because cookie writes from `setActiveBranch`
 * / `clearBranch` can flip this between renders.
 */
export function useBranch() {
  return useAdminQuery({
    queryKey: queryKeys.git.branch(),
    queryFn: () => getBranch(),
    tier: 'realtime',
  });
}
