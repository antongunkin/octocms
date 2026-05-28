import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { CMS_SESSION_QUERY_KEY, useCmsSession } from './useCmsSession';
import { withQuery } from '../admin/query/test/renderWithQuery';

describe('useCmsSession', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns authenticated after session fetch succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: '1', name: 'Tester' } }),
      }),
    );

    const { Wrapper } = withQuery();
    const { result } = renderHook(() => useCmsSession(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.status).toBe('authenticated'));
    expect(result.current.data?.user.name).toBe('Tester');
  });

  it('signOut posts to logout and invalidates session query', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: { id: '1', name: 'Tester' } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true }) });

    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { href: '' });

    const { Wrapper, client } = withQuery();
    client.setQueryData(CMS_SESSION_QUERY_KEY, { user: { id: '1', name: 'Tester' } });

    const { result } = renderHook(() => useCmsSession(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.status).toBe('authenticated'));

    await result.current.signOut();

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/octocms/auth/logout'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
