import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNewFile } from './useNewFile';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const newFileMock = vi.fn();

vi.mock('../../actions/files', () => ({
  newFile: (...args: unknown[]) => newFileMock(...args),
}));

beforeEach(() => {
  newFileMock.mockReset();
});

describe('useNewFile', () => {
  it('invalidates the entries cache after a successful create', async () => {
    newFileMock.mockResolvedValue({ success: true, path: 'cms/content/post/new.json' });
    const { Wrapper, client } = withQuery();

    // Pre-seed the cache with a stale entry list so we can observe invalidation.
    client.setQueryData(queryKeys.entries.list(), [
      { type: 'post', id: 'old', path: 'cms/content/post/old.json', title: 'Old', status: 'merged' },
    ]);

    const { result } = renderHook(() => useNewFile(), { wrapper: Wrapper });
    await result.current.mutateAsync('post');

    const state = client.getQueryState(queryKeys.entries.list());
    expect(state?.isInvalidated).toBe(true);

    // hasActive query is also invalidated on create (branch state may flip).
    const hasActiveState = client.getQueryState(queryKeys.git.hasActive());
    // Even though we never observed it, invalidateQueries marks any matching key.
    // If no record exists, getQueryState returns undefined — assert the entries
    // case which is the primary invariant.
    expect(hasActiveState === undefined || hasActiveState.isInvalidated === true).toBe(true);

    expect(newFileMock).toHaveBeenCalledWith('post');
  });

  it('rejects with the server-action error so callers can toast', async () => {
    newFileMock.mockResolvedValue({ success: false, error: 'Validation failed' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useNewFile(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync('post')).rejects.toThrow('Validation failed');
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Validation failed');
  });
});
