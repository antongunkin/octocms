'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteMedia, moveMedia, updateMediaMetadata, uploadMedia } from '../../actions/media';
import type { UploadMediaResult } from '../../actions/utils';
import { invalidateAfterMutation } from '../invalidate';

/**
 * Media-entry mutations. All four invalidate the `media` domain. Each hook
 * re-throws on `result.success === false` so callers can `try { await mutate
 * Async(...) } catch (e) { toast(e.message) }` uniformly.
 */

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true; id: string }, Error, FormData>({
    mutationFn: async (formData) => {
      const result: UploadMediaResult = await uploadMedia(formData);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateAfterMutation(qc, ['media']),
  });
}

export function useUpdateMediaMetadata() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, { id: string; title: string }>({
    mutationFn: async ({ id, title }) => {
      const result = await updateMediaMetadata(id, title);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateAfterMutation(qc, ['media']),
  });
}

export function useMoveMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, { id: string; folder: string }>({
    mutationFn: async ({ id, folder }) => {
      const result = await moveMedia(id, folder);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateAfterMutation(qc, ['media']),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationFn: async (id) => {
      const result = await deleteMedia(id);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateAfterMutation(qc, ['media']),
  });
}
