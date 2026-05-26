import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const listCMSBranchesMock = vi.fn();
const setActiveBranchMock = vi.fn();
const clearBranchMock = vi.fn();
const publishBranchMock = vi.fn();
const toastMock = vi.fn();

vi.mock('../../admin/query/hooks/useBranchList', () => ({
  useBranchList: ({ enabled }: { enabled: boolean }) => ({
    data: enabled
      ? [
          { branch: 'main', prUrl: '', prNumber: 0, title: 'main', isPublished: true },
          { branch: 'cms/edit-1', prUrl: 'https://github.com/pr/1', prNumber: 1, title: 'Edit', isPublished: false },
        ]
      : undefined,
    isPending: false,
    fetchStatus: enabled ? 'fetching' : 'idle',
  }),
}));

vi.mock('../../admin/query/hooks/useBranchMutations', () => ({
  useSetActiveBranch: () => ({ mutateAsync: (...args: unknown[]) => setActiveBranchMock(...args) }),
  useClearBranch: () => ({ mutateAsync: (...args: unknown[]) => clearBranchMock(...args) }),
  usePublishBranch: () => ({ mutateAsync: (...args: unknown[]) => publishBranchMock(...args) }),
}));

vi.mock('../../hooks/useToast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
}));

const { BranchSelectorDialog } = await import('./BranchSelectorDialog');

beforeEach(() => {
  listCMSBranchesMock.mockReset();
  setActiveBranchMock.mockReset();
  clearBranchMock.mockReset();
  publishBranchMock.mockReset();
  toastMock.mockReset();
  setActiveBranchMock.mockResolvedValue(undefined);
  clearBranchMock.mockResolvedValue(undefined);
  publishBranchMock.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('BranchSelectorDialog', () => {
  it('renders branch list and actions when open', () => {
    render(<BranchSelectorDialog open onOpenChange={vi.fn()} activeBranch="main" onRequestCreateBranch={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Branch' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Create new branch/i })).toBeDefined();
    expect(screen.getByText('main')).toBeDefined();
    expect(screen.getByText('cms/edit-1')).toBeDefined();
    expect(screen.getByRole('button', { name: /Back to main/i })).toBeDefined();
  });

  it('does not render content when closed', () => {
    render(
      <BranchSelectorDialog open={false} onOpenChange={vi.fn()} activeBranch="main" onRequestCreateBranch={vi.fn()} />,
    );

    expect(screen.queryByRole('heading', { name: 'Branch' })).toBeNull();
  });

  it('requests create branch and closes', () => {
    const onOpenChange = vi.fn();
    const onRequestCreateBranch = vi.fn();

    render(
      <BranchSelectorDialog
        open
        onOpenChange={onOpenChange}
        activeBranch="main"
        onRequestCreateBranch={onRequestCreateBranch}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Create new branch/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onRequestCreateBranch).toHaveBeenCalled();
  });

  it('switches branch when a feature branch row is clicked', async () => {
    renderWithQuery(
      <BranchSelectorDialog open onOpenChange={vi.fn()} activeBranch="main" onRequestCreateBranch={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'cms/edit-1' }));

    await waitFor(() => expect(setActiveBranchMock).toHaveBeenCalledWith('cms/edit-1'));
    expect(toastMock).toHaveBeenCalled();
  });

  it('clears branch when Back to main is clicked', async () => {
    const onOpenChange = vi.fn();

    renderWithQuery(
      <BranchSelectorDialog
        open
        onOpenChange={onOpenChange}
        activeBranch="cms/edit-1"
        onRequestCreateBranch={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Back to main/i }));

    await waitFor(() => expect(clearBranchMock).toHaveBeenCalled());
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
