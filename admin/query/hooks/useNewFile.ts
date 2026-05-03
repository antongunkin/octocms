'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { newFile } from '../../actions/files';
import type { NewFileResult } from '../../actions/utils';
import { invalidateAfterMutation } from '../invalidate';

/**
 * Create a new entry of `type`. On success, invalidates every `entries` query
 * (covers `list('*')` and any future detail/collection-scoped keys) and the
 * `git.hasActive` query because creating the first entry on a new branch flips
 * branch state.
 *
 * `newFile` returns `{ success: false, error }` instead of throwing on
 * validation failures; we re-throw so React Query's `onError` / `mutateAsync`
 * rejection paths fire uniformly. Callers can `try { await mutateAsync(...) }
 * catch (e) { toast(e.message) }`.
 */
export function useNewFile() {
  const qc = useQueryClient();
  return useMutation<NewFileResult & { success: true }, Error, string>({
    mutationKey: ['entries', 'new'],
    mutationFn: async (type) => {
      const result = await newFile(type);
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      invalidateAfterMutation(qc, ['entries', 'git']);
    },
  });
}
