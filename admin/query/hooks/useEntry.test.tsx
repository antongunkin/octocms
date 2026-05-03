import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEntry } from './useEntry';
import { withQuery } from '../test/renderWithQuery';

const getFileMock = vi.fn();

vi.mock('../../actions/files', () => ({
  getFile: (...a: unknown[]) => getFileMock(...a),
}));

beforeEach(() => {
  getFileMock.mockReset();
});

describe('useEntry', () => {
  it('does not fetch when filePath is undefined', () => {
    const { Wrapper } = withQuery();
    renderHook(() => useEntry(undefined), { wrapper: Wrapper });
    expect(getFileMock).not.toHaveBeenCalled();
  });

  it('fetches and resolves to the entry payload', async () => {
    getFileMock.mockResolvedValue({ sys: { id: 'a' }, fields: { title: 'A' } });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useEntry('cms/content/post/a.json'), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.fields.title).toBe('A');
    expect(getFileMock).toHaveBeenCalledWith('cms/content/post/a.json');
  });
});
