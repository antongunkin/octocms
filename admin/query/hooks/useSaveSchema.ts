'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { saveSchema, type SaveSchemaOptions } from '../../actions/schema';
import type { Config } from '../../types';
import { invalidateAfterMutation } from '../invalidate';
import { queryKeys } from '../keys';

/**
 * Save the schema. Invalidates `schema` AND `entries` (field renames /
 * deletions migrate entry data, so the entries cache must reflect the new
 * shape). Re-throws on `result.success === false`.
 *
 * Optimistic: applies `next` to `schema.current` immediately; rolls back on
 * failure before invalidation runs.
 */
export function useSaveSchema() {
  const qc = useQueryClient();
  return useMutation<
    { success: true },
    Error,
    { next: Config; options?: SaveSchemaOptions },
    { previous: Config | undefined }
  >({
    mutationKey: ['schema', 'save'],
    mutationFn: async ({ next, options }) => {
      const result = await saveSchema(next, options);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onMutate: async ({ next }) => {
      await qc.cancelQueries({ queryKey: queryKeys.schema.current() });
      const previous = qc.getQueryData<Config>(queryKeys.schema.current());
      qc.setQueryData(queryKeys.schema.current(), next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        qc.setQueryData(queryKeys.schema.current(), ctx.previous);
      }
    },
    onSuccess: () => invalidateAfterMutation(qc, ['schema']),
  });
}
