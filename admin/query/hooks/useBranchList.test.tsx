import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useBranchList } from './useBranchList';
import { withQuery } from '../test/renderWithQuery';

const listCMSBranchesMock = vi.fn();

vi.mock('../../actions/git', () => ({
  listCMSBranches: (...args: unknown[]) => listCMSBranchesMock(...args),
}));

beforeEach(() => {
  listCMSBranchesMock.mockReset();
});

describe('useBranchList', () => {
  it('does not fetch while disabled', () => {
    const { Wrapper } = withQuery();
    listCMSBranchesMock.mockResolvedValue([]);
    renderHook(() => useBranchList({ enabled: false }), { wrapper: Wrapper });
    expect(listCMSBranchesMock).not.toHaveBeenCalled();
  });

  it('fetches when enabled and resolves to the branch list', async () => {
    listCMSBranchesMock.mockResolvedValue([
      { branch: 'feat/x', prNumber: 1, prUrl: 'https://example.com/pr/1', isPublished: false },
    ]);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useBranchList({ enabled: true }), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].branch).toBe('feat/x');
  });
});
