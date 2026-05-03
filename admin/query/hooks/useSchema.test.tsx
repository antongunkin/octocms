import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSchema } from './useSchema';
import { withQuery } from '../test/renderWithQuery';

const getSchemaMock = vi.fn();

vi.mock('../../actions/schema', () => ({
  getSchema: (...a: unknown[]) => getSchemaMock(...a),
}));

beforeEach(() => {
  getSchemaMock.mockReset();
});

describe('useSchema', () => {
  it('resolves to the schema returned by getSchema', async () => {
    getSchemaMock.mockResolvedValue({ projectName: 'X', collections: { post: {} } });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useSchema(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.projectName).toBe('X');
  });

  it('reuses the cache on remount (static tier — never refetches)', async () => {
    getSchemaMock.mockResolvedValue({ projectName: 'X', collections: {} });
    const { Wrapper } = withQuery();

    const first = renderHook(() => useSchema(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    const second = renderHook(() => useSchema(), { wrapper: Wrapper });
    expect(second.result.current.data?.projectName).toBe('X');
    expect(getSchemaMock).toHaveBeenCalledTimes(1);
  });
});
