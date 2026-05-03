import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useAgentStatus } from './useAgentStatus';
import { withQuery } from '../test/renderWithQuery';

const getAgentClientStatusMock = vi.fn();

vi.mock('../../actions/agent', () => ({
  getAgentClientStatus: (...args: unknown[]) => getAgentClientStatusMock(...args),
}));

beforeEach(() => {
  getAgentClientStatusMock.mockReset();
});

describe('useAgentStatus', () => {
  it('resolves to the agent client status', async () => {
    getAgentClientStatusMock.mockResolvedValue({ enabled: true, provider: 'anthropic', model: 'claude' });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useAgentStatus(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.enabled).toBe(true));
  });

  it('reuses the cache on remount (static tier — never refetches)', async () => {
    getAgentClientStatusMock.mockResolvedValue({ enabled: false });
    const { Wrapper } = withQuery();

    const first = renderHook(() => useAgentStatus(), { wrapper: Wrapper });
    await waitFor(() => expect(first.result.current.data).toBeDefined());
    first.unmount();

    const second = renderHook(() => useAgentStatus(), { wrapper: Wrapper });
    expect(second.result.current.data?.enabled).toBe(false);
    expect(getAgentClientStatusMock).toHaveBeenCalledTimes(1);
  });
});
