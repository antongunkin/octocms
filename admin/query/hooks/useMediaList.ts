'use client';

import { getMediaEntries } from '../../actions/media';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * All media entries (one batched fetch). Tier `normal` so the cache aligns
 * with the server-side warm `contentStore` (FRESH 30s).
 */
export function useMediaList() {
  return useAdminQuery({
    queryKey: queryKeys.media.list(),
    queryFn: () => getMediaEntries(),
  });
}
