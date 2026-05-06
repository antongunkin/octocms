'use client';

import { getRecentCMSPullRequests } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Most-recently-updated PRs tagged `cms-update`, across all states. Powers the
 * dashboard "Recent pull requests" card. Tier `realtime` — PR state is
 * mutated outside the admin UI (review, merge, close).
 */
export function useRecentCMSPullRequests(limit = 5) {
  return useAdminQuery({
    queryKey: queryKeys.git.recentCMSPRs(limit),
    queryFn: () => getRecentCMSPullRequests(limit),
    tier: 'realtime',
  });
}
