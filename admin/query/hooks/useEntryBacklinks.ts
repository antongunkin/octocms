'use client';

import { getEntryBacklinks } from '../../actions/entries';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Entries that reference the given reference key (file path stem). Used by
 * the LinkedBy sidebar. Tier `normal`.
 */
export function useEntryBacklinks(referenceKey: string | undefined, options: { enabled?: boolean } = {}) {
  return useAdminQuery({
    queryKey: queryKeys.entries.backlinks(referenceKey ?? ''),
    queryFn: () => getEntryBacklinks(referenceKey!),
    enabled: (options.enabled ?? true) && typeof referenceKey === 'string' && referenceKey.length > 0,
  });
}
