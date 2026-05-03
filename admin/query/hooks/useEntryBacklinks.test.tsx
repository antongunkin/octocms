import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntryBacklinks } from './useEntryBacklinks';
import { withQuery } from '../test/renderWithQuery';

const getEntryBacklinksMock = vi.fn();

vi.mock('../../actions/entries', () => ({
  getEntryBacklinks: (...a: unknown[]) => getEntryBacklinksMock(...a),
}));

beforeEach(() => {
  getEntryBacklinksMock.mockReset();
});

describe('useEntryBacklinks', () => {
  it('does not fetch when reference key is undefined or empty', () => {
    const { Wrapper } = withQuery();
    renderHook(() => useEntryBacklinks(undefined), { wrapper: Wrapper });
    renderHook(() => useEntryBacklinks(''), { wrapper: Wrapper });
    expect(getEntryBacklinksMock).not.toHaveBeenCalled();
  });

  it('does not fetch when explicitly disabled', () => {
    const { Wrapper } = withQuery();
    renderHook(() => useEntryBacklinks('post-a', { enabled: false }), { wrapper: Wrapper });
    expect(getEntryBacklinksMock).not.toHaveBeenCalled();
  });

  it('resolves to the backlinks list', async () => {
    getEntryBacklinksMock.mockResolvedValue([
      { type: 'page', id: 'home', path: 'cms/content/page/home.json', title: 'Home', status: 'merged' },
    ]);
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useEntryBacklinks('post-a'), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toHaveLength(1));
    expect(result.current.data?.[0].title).toBe('Home');
  });
});
