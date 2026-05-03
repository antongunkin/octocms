'use client';

import { useQuery, type UseQueryOptions } from '@tanstack/react-query';

import { getEntryList } from '../../actions/entries';
import type { EntryListItem } from '../../../types';
import { queryKeys } from '../keys';

type EntryListQueryOptions = Pick<UseQueryOptions<EntryListItem[], Error>, 'enabled' | 'placeholderData'>;

/**
 * Read the admin entry list. `collection` defaults to `'**'` (all collections),
 * matching `getEntryList`'s server-side default.
 */
export function useEntryList(collection?: string, options: EntryListQueryOptions = {}) {
  const { enabled = true, placeholderData } = options;
  return useQuery({
    queryKey: queryKeys.entries.list(collection),
    queryFn: () => getEntryList(collection),
    enabled,
    placeholderData,
  });
}
