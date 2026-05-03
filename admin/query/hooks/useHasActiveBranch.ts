'use client';

import { useQuery } from '@tanstack/react-query';

import { hasActiveBranch } from '../../actions/git';
import { queryKeys } from '../keys';

export function useHasActiveBranch() {
  return useQuery({
    queryKey: queryKeys.git.hasActive(),
    queryFn: () => hasActiveBranch(),
  });
}
