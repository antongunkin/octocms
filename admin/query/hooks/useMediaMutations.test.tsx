import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeleteMedia, useMoveMedia, useUpdateMediaMetadata, useUploadMedia } from './useMediaMutations';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const uploadMediaMock = vi.fn();
const updateMediaMetadataMock = vi.fn();
const moveMediaMock = vi.fn();
const deleteMediaMock = vi.fn();

vi.mock('../../actions/media', () => ({
  uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
  updateMediaMetadata: (...a: unknown[]) => updateMediaMetadataMock(...a),
  moveMedia: (...a: unknown[]) => moveMediaMock(...a),
  deleteMedia: (...a: unknown[]) => deleteMediaMock(...a),
}));

beforeEach(() => {
  uploadMediaMock.mockReset();
  updateMediaMetadataMock.mockReset();
  moveMediaMock.mockReset();
  deleteMediaMock.mockReset();
});

describe('useUploadMedia', () => {
  it('invalidates the media cache after a successful upload', async () => {
    uploadMediaMock.mockResolvedValue({ success: true, id: 'new-id' });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.media.list(), [{ id: 'old' }]);

    const { result } = renderHook(() => useUploadMedia(), { wrapper: Wrapper });
    const formData = new FormData();
    formData.set('file', new Blob(['x'], { type: 'image/png' }), 'x.png');
    await result.current.mutateAsync(formData);

    expect(client.getQueryState(queryKeys.media.list())?.isInvalidated).toBe(true);
  });

  it('rejects when the action returns success: false', async () => {
    uploadMediaMock.mockResolvedValue({ success: false, error: 'Bad file' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useUploadMedia(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync(new FormData())).rejects.toThrow('Bad file');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useUpdateMediaMetadata', () => {
  it('invalidates media after a successful update', async () => {
    updateMediaMetadataMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.media.list(), []);

    const { result } = renderHook(() => useUpdateMediaMetadata(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: 'a', title: 'New title' });

    expect(updateMediaMetadataMock).toHaveBeenCalledWith('a', 'New title');
    expect(client.getQueryState(queryKeys.media.list())?.isInvalidated).toBe(true);
  });
});

describe('useMoveMedia', () => {
  it('invalidates media after a successful move', async () => {
    moveMediaMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.media.list(), []);

    const { result } = renderHook(() => useMoveMedia(), { wrapper: Wrapper });
    await result.current.mutateAsync({ id: 'a', folder: 'blog' });

    expect(moveMediaMock).toHaveBeenCalledWith('a', 'blog');
    expect(client.getQueryState(queryKeys.media.list())?.isInvalidated).toBe(true);
  });
});

describe('useDeleteMedia', () => {
  it('invalidates media after a successful delete', async () => {
    deleteMediaMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.media.list(), [{ id: 'a' }]);

    const { result } = renderHook(() => useDeleteMedia(), { wrapper: Wrapper });
    await result.current.mutateAsync('a');

    expect(deleteMediaMock).toHaveBeenCalledWith('a');
    expect(client.getQueryState(queryKeys.media.list())?.isInvalidated).toBe(true);
  });
});
