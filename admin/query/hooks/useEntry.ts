'use client';

import { getFile } from '../../actions/files';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Read a single content entry by file path. Tier `normal` so the cache
 * aligns with the server-side warm `contentStore` (FRESH 30s).
 *
 * `enabled` is `true` only when `filePath` is non-empty so the editor's
 * pre-resolution render doesn't fire a no-op fetch.
 */
export function useEntry(filePath: string | undefined) {
  return useAdminQuery({
    queryKey: queryKeys.entries.detail(filePath ?? ''),
    queryFn: () => getFile(filePath!),
    enabled: typeof filePath === 'string' && filePath.length > 0,
  });
}
