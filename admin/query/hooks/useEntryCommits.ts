'use client';

import { getEntryCommits } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Commit history for a single entry file. Tier `realtime` because commits
 * accrue from outside the CMS too. Lazy via `enabled` so the History sidebar
 * only fetches when it actually mounts.
 */
export function useEntryCommits(filePath: string | undefined, options: { enabled?: boolean } = {}) {
  return useAdminQuery({
    queryKey: queryKeys.entries.commits(filePath ?? ''),
    queryFn: () => getEntryCommits(filePath!),
    tier: 'realtime',
    enabled: (options.enabled ?? true) && typeof filePath === 'string' && filePath.length > 0,
  });
}
