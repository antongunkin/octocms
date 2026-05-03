import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaAsset } from './useMediaAsset';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const getMediaEntriesMock = vi.fn();

vi.mock('../../actions/media', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
}));

beforeEach(() => {
  getMediaEntriesMock.mockReset();
});

const sample = [
  { id: 'a', title: 'A', originalName: 'a.png', folder: '/' },
  { id: 'b', title: 'B', originalName: 'b.png', folder: 'blog' },
];

describe('useMediaAsset', () => {
  it('resolves the asset by id from the cached media list', async () => {
    getMediaEntriesMock.mockResolvedValue(sample);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useMediaAsset('b'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.asset?.id).toBe('b'));
    expect(result.current.allFiles).toHaveLength(2);
  });

  it('returns asset=null and isLoading=false when the list resolves but the id is missing', async () => {
    getMediaEntriesMock.mockResolvedValue(sample);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useMediaAsset('missing'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.asset).toBeNull();
  });

  it('reads the pre-seeded cache without firing getMediaEntries', () => {
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.media.list(), sample);

    const { result } = renderHook(() => useMediaAsset('a'), { wrapper: Wrapper });
    expect(result.current.asset?.id).toBe('a');
    expect(getMediaEntriesMock).not.toHaveBeenCalled();
  });
});
