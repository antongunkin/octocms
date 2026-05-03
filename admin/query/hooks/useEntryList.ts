'use client';

import { useQuery } from '@tanstack/react-query';

import { getEntryList } from '../../actions/entries';
import { queryKeys } from '../keys';

/**
 * Read the admin entry list. `collection` defaults to `'**'` (all collections),
 * matching `getEntryList`'s server-side default.
 */
export function useEntryList(collection?: string) {
  return useQuery({
    queryKey: queryKeys.entries.list(collection),
    queryFn: () => getEntryList(collection),
  });
}
