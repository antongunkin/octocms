import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntryList } from './useEntryList';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const getEntryListMock = vi.fn();

vi.mock('../../actions/entries', () => ({
  getEntryList: (...args: unknown[]) => getEntryListMock(...args),
}));

beforeEach(() => {
  getEntryListMock.mockReset();
});

describe('useEntryList', () => {
  it('resolves to the entry list returned by getEntryList', async () => {
    getEntryListMock.mockResolvedValue([
      { type: 'post', id: 'a', path: 'cms/content/post/a.json', title: 'A', status: 'merged' },
    ]);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useEntryList(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.data).toHaveLength(1);
    });
    expect(result.current.data?.[0].title).toBe('A');
    expect(getEntryListMock).toHaveBeenCalledTimes(1);
  });

  it('reuses the cache on a second mount with the same client (no extra fetch)', async () => {
    getEntryListMock.mockResolvedValue([
      { type: 'post', id: 'a', path: 'cms/content/post/a.json', title: 'A', status: 'merged' },
    ]);
    const { Wrapper, client } = withQuery();

    const first = renderHook(() => useEntryList(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    // Sanity: cache populated under the canonical key
    expect(client.getQueryData(queryKeys.entries.list())).toHaveLength(1);

    const second = renderHook(() => useEntryList(), { wrapper: Wrapper });
    // Cache hit: data is available synchronously, no pending state.
    expect(second.result.current.data).toHaveLength(1);
    expect(getEntryListMock).toHaveBeenCalledTimes(1);
  });
});
