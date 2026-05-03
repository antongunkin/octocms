'use client';

import { getIsProduction } from '../../actions/git';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

/**
 * Whether the app is running in production mode. Tier `static` because
 * `process.env.NODE_ENV` doesn't change at runtime.
 */
export function useIsProduction() {
  return useAdminQuery({
    queryKey: queryKeys.git.isProduction(),
    queryFn: () => getIsProduction(),
    tier: 'static',
  });
}
