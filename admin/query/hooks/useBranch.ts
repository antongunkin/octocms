'use client';

import { useQuery } from '@tanstack/react-query';

import { getBranch } from '../../actions/git';
import { queryKeys } from '../keys';

export function useBranch() {
  return useQuery({
    queryKey: queryKeys.git.branch(),
    queryFn: () => getBranch(),
  });
}
