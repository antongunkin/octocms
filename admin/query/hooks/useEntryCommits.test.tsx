import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntryCommits } from './useEntryCommits';
import { withQuery } from '../test/renderWithQuery';

const getEntryCommitsMock = vi.fn();

vi.mock('../../actions/git', () => ({
  getEntryCommits: (...a: unknown[]) => getEntryCommitsMock(...a),
}));

beforeEach(() => {
  getEntryCommitsMock.mockReset();
});

describe('useEntryCommits', () => {
  it('does not fetch when filePath is undefined', () => {
    const { Wrapper } = withQuery();
    renderHook(() => useEntryCommits(undefined), { wrapper: Wrapper });
    expect(getEntryCommitsMock).not.toHaveBeenCalled();
  });

  it('does not fetch when explicitly disabled', () => {
    const { Wrapper } = withQuery();
    renderHook(() => useEntryCommits('cms/content/post/a.json', { enabled: false }), { wrapper: Wrapper });
    expect(getEntryCommitsMock).not.toHaveBeenCalled();
  });

  it('fetches the commits when enabled and the path is set', async () => {
    getEntryCommitsMock.mockResolvedValue({ commits: [{ sha: 'a' }], seeAllUrl: 'https://x' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useEntryCommits('cms/content/post/a.json'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.commits).toHaveLength(1));
  });
});
