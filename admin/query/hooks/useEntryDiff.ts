'use client';

import { getEntryDiff } from '../../actions/diff';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Branch-vs-base diff for one entry (JSON + companions). Tier `normal` — same
 * cadence as entry reads; invalidated with the `entries` domain.
 */
export function useEntryDiff(filePath: string | undefined) {
  return useAdminQuery({
    queryKey: queryKeys.entries.diff(filePath ?? ''),
    queryFn: () => getEntryDiff(filePath!),
    enabled: typeof filePath === 'string' && filePath.length > 0,
  });
}
