'use client';

import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { archiveEntry, publishEntry, restoreEntry } from '../../actions/status';
import { removeFile, saveFile } from '../../actions/files';
import type { SaveFileResult } from '../../actions/utils';
import { getConfig } from '../../../lib/configStore';
import { resolveEntryTitle } from '../../../lib/resolveEntryTitle';
import type { EntryListItem } from '../../../types';
import { invalidateAfterMutationAsync } from '../invalidate';
import { queryKeys } from '../keys';

function invalidateEntriesCache(qc: QueryClient) {
  return invalidateAfterMutationAsync(qc, ['entries']);
}

function mergeEntryCachePayload(
  old: Record<string, unknown> | undefined,
  incoming: { sys: Record<string, unknown>; fields: Record<string, unknown> },
): Record<string, unknown> {
  if (!old || typeof old !== 'object') {
    return { ...incoming };
  }
  const prevSys = typeof old.sys === 'object' && old.sys !== null ? (old.sys as Record<string, unknown>) : {};
  const prevFields =
    typeof old.fields === 'object' && old.fields !== null ? (old.fields as Record<string, unknown>) : {};
  return {
    ...old,
    sys: { ...prevSys, ...incoming.sys },
    fields: { ...prevFields, ...incoming.fields },
  };
}

function patchEntryListRows(qc: QueryClient, fileName: string, entryPayload: { sys: any; fields: any }) {
  let title: string;
  try {
    title = resolveEntryTitle(getConfig(), fileName, entryPayload);
  } catch {
    return;
  }
  const status = typeof entryPayload.sys?.status === 'string' ? entryPayload.sys.status : undefined;
  qc.setQueriesData({ queryKey: queryKeys.entries.all }, (old: unknown) => {
    if (!Array.isArray(old)) return old;
    return (old as EntryListItem[]).map((row) => {
      if (row.path !== fileName) return row;
      const next: EntryListItem = { ...row, title };
      if (status) next.status = status as EntryListItem['status'];
      return next;
    });
  });
}

/**
 * Entry-level mutations. All invalidate the `entries` domain (covers list,
 * detail, commits, backlinks, diff). `saveFile` propagates `fieldErrors` on the
 * thrown error so the form can show per-field validation messages — we
 * attach them as `(error as Error & { fieldErrors? }).fieldErrors`.
 */

type SavePayload = {
  fileName: string;
  data: { sys: any; fields: any };
  options?: { skipStatusTransition?: boolean };
};

type SaveFileError = Error & { fieldErrors?: Record<string, string> };

export function useSaveFile() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, SaveFileError, SavePayload, { previousDetail: unknown | undefined }>({
    mutationKey: ['entries', 'save'],
    mutationFn: async ({ fileName, data, options }) => {
      const result: SaveFileResult = await saveFile(data, fileName, options);
      if (!result.success) {
        const err: SaveFileError = new Error(result.error);
        if ('fieldErrors' in result && result.fieldErrors) {
          err.fieldErrors = result.fieldErrors;
        }
        throw err;
      }
      return result;
    },
    onMutate: async ({ fileName, data }) => {
      await qc.cancelQueries({ queryKey: queryKeys.entries.detail(fileName) });
      const previousDetail = qc.getQueryData(queryKeys.entries.detail(fileName));
      qc.setQueryData(queryKeys.entries.detail(fileName), (old) =>
        mergeEntryCachePayload(old as Record<string, unknown> | undefined, data),
      );
      patchEntryListRows(qc, fileName, data);
      return { previousDetail };
    },
    onError: (_err, { fileName }, ctx) => {
      if (ctx?.previousDetail !== undefined) {
        qc.setQueryData(queryKeys.entries.detail(fileName), ctx.previousDetail);
      } else {
        qc.removeQueries({ queryKey: queryKeys.entries.detail(fileName) });
      }
      void qc.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey as unknown[];
          return k[0] === 'entries' && k[1] === 'list';
        },
      });
    },
    onSuccess: async (_data, { fileName, data }) => {
      qc.setQueryData(queryKeys.entries.detail(fileName), (old) =>
        mergeEntryCachePayload(old as Record<string, unknown> | undefined, data),
      );
      patchEntryListRows(qc, fileName, data);
      await invalidateEntriesCache(qc);
    },
  });
}

export function useRemoveFile() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['entries', 'remove'],
    mutationFn: async (fileName) => {
      const result = await removeFile(fileName);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateEntriesCache(qc),
  });
}

export function usePublishEntry() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['entries', 'publish'],
    mutationFn: async (fileName) => {
      const result = await publishEntry(fileName);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateEntriesCache(qc),
  });
}

export function useArchiveEntry() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['entries', 'archive'],
    mutationFn: async (fileName) => {
      const result = await archiveEntry(fileName);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateEntriesCache(qc),
  });
}

export function useRestoreEntry() {
  const qc = useQueryClient();
  return useMutation<{ success: true }, Error, string>({
    mutationKey: ['entries', 'restore'],
    mutationFn: async (fileName) => {
      const result = await restoreEntry(fileName);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => invalidateEntriesCache(qc),
  });
}
