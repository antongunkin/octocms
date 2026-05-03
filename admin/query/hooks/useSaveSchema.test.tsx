import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSaveSchema } from './useSaveSchema';
import { queryKeys } from '../keys';
import { withQuery } from '../test/renderWithQuery';

const saveSchemaMock = vi.fn();

vi.mock('../../actions/schema', () => ({
  saveSchema: (...a: unknown[]) => saveSchemaMock(...a),
}));

beforeEach(() => {
  saveSchemaMock.mockReset();
});

describe('useSaveSchema', () => {
  it('invalidates schema AND entries after a successful save', async () => {
    saveSchemaMock.mockResolvedValue({ success: true });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.schema.current(), { projectName: 'old' });
    client.setQueryData(queryKeys.entries.list(), [{ id: 'a' }]);

    const { result } = renderHook(() => useSaveSchema(), { wrapper: Wrapper });
    await result.current.mutateAsync({
      next: { projectName: 'new', collections: {} } as any,
      options: { message: 'CMS: rename' },
    });

    expect(saveSchemaMock).toHaveBeenCalledWith({ projectName: 'new', collections: {} }, { message: 'CMS: rename' });
    expect(client.getQueryState(queryKeys.schema.current())?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated).toBe(true);
  });

  it('rejects with the action error when saveSchema fails', async () => {
    saveSchemaMock.mockResolvedValue({ success: false, error: 'Validation failed' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useSaveSchema(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ next: {} as any })).rejects.toThrow('Validation failed');
    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('restores the previous schema cache when saveSchema fails after optimistic apply', async () => {
    const prev = { projectName: 'old', collections: {} } as any;
    saveSchemaMock.mockResolvedValue({ success: false, error: 'bad' });
    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.schema.current(), prev);

    const { result } = renderHook(() => useSaveSchema(), { wrapper: Wrapper });
    await expect(result.current.mutateAsync({ next: { projectName: 'new', collections: {} } as any })).rejects.toThrow(
      'bad',
    );

    expect((client.getQueryData(queryKeys.schema.current()) as { projectName?: string })?.projectName).toBe('old');
  });
});
