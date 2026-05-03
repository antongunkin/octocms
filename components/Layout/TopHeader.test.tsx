import React from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TopHeader } from './TopHeader';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getBranchMock, hasActiveBranchMock, getIsProductionMock, listCMSBranchesMock, getAgentClientStatusMock } =
  vi.hoisted(() => ({
    getBranchMock: vi.fn(),
    hasActiveBranchMock: vi.fn(),
    getIsProductionMock: vi.fn(),
    listCMSBranchesMock: vi.fn(),
    getAgentClientStatusMock: vi.fn(),
  }));

vi.mock('../../admin/actions/git', () => ({
  getBranch: (...a: unknown[]) => getBranchMock(...a),
  hasActiveBranch: (...a: unknown[]) => hasActiveBranchMock(...a),
  getIsProduction: (...a: unknown[]) => getIsProductionMock(...a),
  listCMSBranches: (...a: unknown[]) => listCMSBranchesMock(...a),
  setActiveBranch: vi.fn(),
  clearBranch: vi.fn(),
  publishBranch: vi.fn(),
}));

vi.mock('../../admin/actions/agent', () => ({
  getAgentClientStatus: (...a: unknown[]) => getAgentClientStatusMock(...a),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({ projectName: 'Test' }),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: { user: { name: 'Tester', image: '' } } }),
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
}));

vi.mock('../../admin/theme', () => ({
  ThemeToggle: () => null,
}));

vi.mock('../CreateBranchDialog', () => ({
  default: () => null,
}));

beforeEach(() => {
  getBranchMock.mockReset();
  hasActiveBranchMock.mockReset();
  getIsProductionMock.mockReset();
  listCMSBranchesMock.mockReset();
  getAgentClientStatusMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TopHeader', () => {
  it('renders the BranchChip skeleton while branch queries are loading', () => {
    getBranchMock.mockReturnValue(new Promise(() => {}));
    hasActiveBranchMock.mockReturnValue(new Promise(() => {}));
    getIsProductionMock.mockResolvedValue(false);
    getAgentClientStatusMock.mockResolvedValue({ enabled: false });

    renderWithQuery(<TopHeader />);

    expect(screen.getByLabelText('Loading branch')).toBeDefined();
  });

  it('shows the resolved branch label after queries settle', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    getIsProductionMock.mockResolvedValue(false);
    getAgentClientStatusMock.mockResolvedValue({ enabled: false });

    renderWithQuery(<TopHeader />);

    await waitFor(() => {
      expect(screen.queryByLabelText('Loading branch')).toBeNull();
    });
    expect(screen.getByText('main')).toBeDefined();
  });

  it('hides the Chat nav link when the agent is disabled, shows it when enabled', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    getIsProductionMock.mockResolvedValue(false);
    getAgentClientStatusMock.mockResolvedValue({ enabled: false });

    const { unmount } = renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByText('main')).not.toBeNull());
    expect(screen.queryByText('Chat')).toBeNull();
    unmount();

    getAgentClientStatusMock.mockResolvedValue({ enabled: true, provider: 'anthropic', model: 'haiku' });
    renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByText('Chat')).not.toBeNull());
  });

  it('does not call listCMSBranches until the branch dropdown opens', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    getIsProductionMock.mockResolvedValue(false);
    getAgentClientStatusMock.mockResolvedValue({ enabled: false });
    listCMSBranchesMock.mockResolvedValue([]);

    renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByText('main')).not.toBeNull());

    expect(listCMSBranchesMock).not.toHaveBeenCalled();
  });
});
