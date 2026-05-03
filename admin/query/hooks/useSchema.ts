'use client';

import { getSchema } from '../../actions/schema';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Read the live `cms/schema.json`. Tier `static` because the schema only
 * changes from inside the Visual Schema Editor — when it does, the
 * `useSaveSchema` mutation invalidates this key so the UI re-reads it.
 */
export function useSchema() {
  return useAdminQuery({
    queryKey: queryKeys.schema.current(),
    queryFn: () => getSchema(),
    tier: 'static',
  });
}
