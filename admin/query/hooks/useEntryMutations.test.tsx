import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useArchiveEntry, usePublishEntry, useRemoveFile, useRestoreEntry, useSaveFile } from './useEntryMutations';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const saveFileMock = vi.fn();
const removeFileMock = vi.fn();
const publishEntryMock = vi.fn();
const archiveEntryMock = vi.fn();
const restoreEntryMock = vi.fn();

vi.mock('../../actions/files', () => ({
  saveFile: (...a: unknown[]) => saveFileMock(...a),
  removeFile: (...a: unknown[]) => removeFileMock(...a),
}));

vi.mock('../../actions/status', () => ({
  publishEntry: (...a: unknown[]) => publishEntryMock(...a),
  archiveEntry: (...a: unknown[]) => archiveEntryMock(...a),
  restoreEntry: (...a: unknown[]) => restoreEntryMock(...a),
}));

beforeEach(() => {
  saveFileMock.mockReset();
  removeFileMock.mockReset();
  publishEntryMock.mockReset();
  archiveEntryMock.mockReset();
  restoreEntryMock.mockReset();
});

describe('useSaveFile', () => {
  it('invalidates the entries cache after a successful save', async () => {
    saveFileMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.entries.list(), []);
    client.setQueryData(queryKeys.entries.detail('cms/content/post/a.json'), { sys: {}, fields: {} });

    const { result } = renderHook(() => useSaveFile(), { wrapper: Wrapper });
    await result.current.mutateAsync({
      fileName: 'cms/content/post/a.json',
      data: { sys: {}, fields: { title: 'New' } },
    });

    expect(saveFileMock).toHaveBeenCalledWith(
      { sys: {}, fields: { title: 'New' } },
      'cms/content/post/a.json',
      undefined,
    );
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.entries.detail('cms/content/post/a.json'))?.isInvalidated).toBe(true);
  });

  it('rolls back the detail cache when saveFile rejects after an optimistic update', async () => {
    const detailKey = queryKeys.entries.detail('cms/content/post/a.json');
    const prev = { sys: { status: 'draft' }, fields: { title: 'Old' } };
    saveFileMock.mockRejectedValueOnce(new Error('network'));
    const { Wrapper, client } = withQuery();
    client.setQueryData(detailKey, prev);

    const { result } = renderHook(() => useSaveFile(), { wrapper: Wrapper });
    await expect(
      result.current.mutateAsync({
        fileName: 'cms/content/post/a.json',
        data: { sys: {}, fields: { title: 'Optimistic' } },
      }),
    ).rejects.toThrow('network');

    expect(client.getQueryData(detailKey)).toEqual(prev);
  });

  it('attaches fieldErrors to the rejected error so callers can show per-field validation', async () => {
    saveFileMock.mockResolvedValue({
      success: false,
      error: 'Validation failed',
      fieldErrors: { title: 'Title required' },
    });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useSaveFile(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({ fileName: 'a.json', data: { sys: {}, fields: {} } }),
    ).rejects.toMatchObject({ message: 'Validation failed', fieldErrors: { title: 'Title required' } });
  });
});

describe('useRemoveFile', () => {
  it('invalidates entries after successful delete', async () => {
    removeFileMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.entries.list(), []);

    const { result } = renderHook(() => useRemoveFile(), { wrapper: Wrapper });
    await result.current.mutateAsync('cms/content/post/a.json');

    expect(removeFileMock).toHaveBeenCalledWith('cms/content/post/a.json');
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });
});

describe('usePublishEntry / useArchiveEntry / useRestoreEntry', () => {
  it.each([
    ['publish', usePublishEntry, publishEntryMock] as const,
    ['archive', useArchiveEntry, archiveEntryMock] as const,
    ['restore', useRestoreEntry, restoreEntryMock] as const,
  ])('%s — invalidates entries after success', async (_label, hook, mock) => {
    mock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.entries.list(), []);

    const { result } = renderHook(() => hook(), { wrapper: Wrapper });
    await result.current.mutateAsync('cms/content/post/a.json');

    expect(mock).toHaveBeenCalledWith('cms/content/post/a.json');
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });

  it('publishEntry rejects with the action error message', async () => {
    publishEntryMock.mockResolvedValue({ success: false, error: 'No branch' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => usePublishEntry(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync('cms/content/post/a.json')).rejects.toThrow('No branch');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
