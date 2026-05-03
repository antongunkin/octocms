import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useClearBranch, usePublishBranch, useSetActiveBranch } from './useBranchMutations';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const setActiveBranchMock = vi.fn();
const clearBranchMock = vi.fn();
const publishBranchMock = vi.fn();

vi.mock('../../actions/git', () => ({
  setActiveBranch: (...args: unknown[]) => setActiveBranchMock(...args),
  clearBranch: (...args: unknown[]) => clearBranchMock(...args),
  publishBranch: (...args: unknown[]) => publishBranchMock(...args),
}));

beforeEach(() => {
  setActiveBranchMock.mockReset();
  clearBranchMock.mockReset();
  publishBranchMock.mockReset();
});

describe('useSetActiveBranch', () => {
  it('invalidates git + entries after success', async () => {
    setActiveBranchMock.mockResolvedValue(undefined);
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.git.branch(), 'main');
    client.setQueryData(queryKeys.entries.list(), []);

    const { result } = renderHook(() => useSetActiveBranch(), { wrapper: Wrapper });
    await result.current.mutateAsync('feat/x');

    expect(setActiveBranchMock).toHaveBeenCalledWith('feat/x');
    expect(client.getQueryState(queryKeys.git.branch())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });
});

describe('useClearBranch', () => {
  it('invalidates git + entries after success', async () => {
    clearBranchMock.mockResolvedValue(undefined);
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.git.branch(), 'feat/x');
    client.setQueryData(queryKeys.entries.list(), [{ id: 'a' }]);

    const { result } = renderHook(() => useClearBranch(), { wrapper: Wrapper });
    await result.current.mutateAsync();

    expect(clearBranchMock).toHaveBeenCalled();
    expect(client.getQueryState(queryKeys.git.branch())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });
});

describe('usePublishBranch', () => {
  it('invalidates git + entries after a successful publish', async () => {
    publishBranchMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.git.branches(), []);
    client.setQueryData(queryKeys.entries.list(), []);

    const { result } = renderHook(() => usePublishBranch(), { wrapper: Wrapper });
    await result.current.mutateAsync('feat/x');

    expect(publishBranchMock).toHaveBeenCalledWith('feat/x');
    expect(client.getQueryState(queryKeys.git.branches())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });

  it('rejects with the action error message when publish fails', async () => {
    publishBranchMock.mockResolvedValue({ success: false, error: 'No branch' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => usePublishBranch(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync('feat/x')).rejects.toThrow('No branch');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
