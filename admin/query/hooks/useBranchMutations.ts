'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { clearBranch, publishBranch, setActiveBranch } from '../../actions/git';
import { invalidateAfterMutationAsync } from '../invalidate';

/**
 * Branch-state mutations. All three invalidate the `git` domain (which fans
 * out to `entries` per `invalidateAfterMutation` — different branch ⇒
 * different entry list).
 *
 * `publishBranch` returns `ActionResult` (`{ success, error? }`); the hook
 * re-throws on `success: false` so `mutateAsync` rejects and toast handlers
 * fire uniformly. `setActiveBranch` and `clearBranch` return `void` and never
 * fail at the action layer (cookie writes), so no re-throw needed.
 */

export function useSetActiveBranch() {
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationKey: ['git', 'setActiveBranch'],
    mutationFn: (branch) => setActiveBranch(branch),
    onSuccess: () => invalidateAfterMutationAsync(qc, ['git']),
  });
}

export function useClearBranch() {
  const qc = useQueryClient();
  return useMutation<void, Error, void>({
    mutationKey: ['git', 'clearBranch'],
    mutationFn: () => clearBranch(),
    onSuccess: () => invalidateAfterMutationAsync(qc, ['git']),
  });
}

export function usePublishBranch() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['git', 'publishBranch'],
    mutationFn: async (branch) => {
      const result = await publishBranch(branch);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateAfterMutationAsync(qc, ['git']),
  });
}
