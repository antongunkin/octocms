import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useMediaList } from './useMediaList';
import { withQuery } from '../test/renderWithQuery';

const getMediaEntriesMock = vi.fn();

vi.mock('../../actions/media', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
}));

beforeEach(() => {
  getMediaEntriesMock.mockReset();
});

describe('useMediaList', () => {
  it('resolves to the media entries returned by getMediaEntries', async () => {
    getMediaEntriesMock.mockResolvedValue([{ id: 'a', title: 'A' }]);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useMediaList(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].id).toBe('a');
  });

  it('reuses the cache on a second mount with the same client', async () => {
    getMediaEntriesMock.mockResolvedValue([{ id: 'a', title: 'A' }]);
    const { Wrapper } = withQuery();

    const first = renderHook(() => useMediaList(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    const second = renderHook(() => useMediaList(), { wrapper: Wrapper });
    expect(second.result.current.data).toHaveLength(1);
    expect(getMediaEntriesMock).toHaveBeenCalledTimes(1);
  });
});
