'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { deleteMedia, moveMedia, updateMediaMetadata, uploadMedia } from '../../actions/media';
import type { UploadMediaResult } from '../../actions/utils';
import { invalidateAfterMutationAsync } from '../invalidate';

function invalidateMediaCache(qc: QueryClient) {
  return invalidateAfterMutationAsync(qc, ['media']);
}

/**
 * Media-entry mutations. All four invalidate the `media` domain. Each hook
 * re-throws on `result.success === false` so callers can `try { await mutate
 * Async(...) } catch (e) { toast(e.message) }` uniformly.
 */

export function useUploadMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true; id: string }, Error, FormData>({
    mutationKey: ['media', 'upload'],
    mutationFn: async (formData) => {
      const result: UploadMediaResult = await uploadMedia(formData);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateMediaCache(qc),
  });
}

export function useUpdateMediaMetadata() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, { id: string; title: string }>({
    mutationKey: ['media', 'update'],
    mutationFn: async ({ id, title }) => {
      const result = await updateMediaMetadata(id, title);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateMediaCache(qc),
  });
}

export function useMoveMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, { id: string; folder: string }>({
    mutationKey: ['media', 'move'],
    mutationFn: async ({ id, folder }) => {
      const result = await moveMedia(id, folder);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateMediaCache(qc),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['media', 'delete'],
    mutationFn: async (id) => {
      const result = await deleteMedia(id);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateMediaCache(qc),
  });
}
