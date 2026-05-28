import React from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TopHeader } from './TopHeader';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getBranchMock, hasActiveBranchMock, listCMSBranchesMock } = vi.hoisted(() => ({
  getBranchMock: vi.fn(),
  hasActiveBranchMock: vi.fn(),
  listCMSBranchesMock: vi.fn(),
}));

vi.mock('../../admin/actions/git', () => ({
  getBranch: (...a: unknown[]) => getBranchMock(...a),
  hasActiveBranch: (...a: unknown[]) => hasActiveBranchMock(...a),
  listCMSBranches: (...a: unknown[]) => listCMSBranchesMock(...a),
  setActiveBranch: vi.fn(),
  clearBranch: vi.fn(),
  publishBranch: vi.fn(),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({ projectName: 'Test' }),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('../../hooks/useCmsSession', () => ({
  useCmsSession: () => ({
    data: { user: { id: '1', name: 'Tester', image: '' } },
    status: 'authenticated',
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/cms',
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock('./CreateBranchDialog', () => ({
  default: () => null,
}));

vi.mock('./BranchSelectorDialog', () => ({
  BranchSelectorDialog: ({ open, onRequestCreateBranch }: { open: boolean; onRequestCreateBranch: () => void }) =>
    open ? (
      <div data-testid="branch-selector-dialog">
        <button type="button" onClick={onRequestCreateBranch}>
          Create new branch
        </button>
      </div>
    ) : null,
}));

vi.mock('./UserAccountDialog', () => ({
  UserAccountDialog: ({ open, userName }: { open: boolean; userName?: string | null }) =>
    open ? <div data-testid="user-account-dialog">{userName}</div> : null,
}));

beforeEach(() => {
  getBranchMock.mockReset();
  hasActiveBranchMock.mockReset();
  listCMSBranchesMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('TopHeader', () => {
  it('renders the BranchChip skeleton while branch queries are loading', () => {
    getBranchMock.mockReturnValue(new Promise(() => {}));
    hasActiveBranchMock.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<TopHeader />);

    expect(screen.getByLabelText('Loading branch')).toBeDefined();
  });

  it('shows the resolved branch label after queries settle', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    renderWithQuery(<TopHeader />);

    await waitFor(() => {
      expect(screen.queryByLabelText('Loading branch')).toBeNull();
    });
    expect(screen.getByText('main')).toBeDefined();
  });

  it('always shows the Chat nav link', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);

    renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByText('main')).not.toBeNull());
    expect(screen.getByRole('link', { name: 'Chat' })).toBeDefined();
  });

  it('opens the branch dialog from main and lists Create new branch', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    listCMSBranchesMock.mockResolvedValue([]);

    renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByLabelText('Loading branch')).toBeNull());

    const trigger = screen.getByRole('button', { name: 'Branch menu, main' });
    expect((trigger as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(trigger);

    expect(await screen.findByTestId('branch-selector-dialog')).toBeDefined();
    expect(screen.getByText('Create new branch')).toBeDefined();
  });

  it('opens the account dialog when the avatar button is clicked', async () => {
    getBranchMock.mockResolvedValue('main');
    hasActiveBranchMock.mockResolvedValue(false);
    renderWithQuery(<TopHeader />);
    await waitFor(() => expect(screen.queryByText('main')).not.toBeNull());

    fireEvent.click(screen.getByRole('button', { name: 'Account' }));

    expect(await screen.findByTestId('user-account-dialog')).toBeDefined();
    expect(screen.getByText('Tester')).toBeDefined();
  });
});
