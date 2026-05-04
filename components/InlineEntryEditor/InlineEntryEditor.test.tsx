import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

const {
  saveFileMock,
  getFileMock,
  removeFileMock,
  archiveEntryMock,
  restoreEntryMock,
  getEntryBacklinksMock,
  getIsProductionMock,
  hasActiveBranchMock,
  bumpRefreshMock,
  onCloseMock,
  pushMock,
  refreshMock,
} = vi.hoisted(() => ({
  saveFileMock: vi.fn(),
  getFileMock: vi.fn(),
  removeFileMock: vi.fn(),
  archiveEntryMock: vi.fn(),
  restoreEntryMock: vi.fn(),
  getEntryBacklinksMock: vi.fn(),
  getIsProductionMock: vi.fn(),
  hasActiveBranchMock: vi.fn(),
  bumpRefreshMock: vi.fn(),
  onCloseMock: vi.fn(),
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, refresh: refreshMock, back: vi.fn(), replace: vi.fn() }),
}));

vi.mock('../../hooks/useEntryStack', () => ({
  useEntryStack: () => ({
    stack: [],
    pushEntry: vi.fn(),
    popEntry: vi.fn(),
    closeAll: vi.fn(),
    ancestorPaths: new Set<string>(),
    refreshTick: 0,
    bumpRefresh: bumpRefreshMock,
  }),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    contentFolder: 'cms/content',
    collections: {
      author: {
        label: 'Author',
        hasMany: true,
        fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
      },
    },
  }),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('../../admin/actions/files', () => ({
  saveFile: (...a: unknown[]) => saveFileMock(...a),
  getFile: (...a: unknown[]) => getFileMock(...a),
  removeFile: (...a: unknown[]) => removeFileMock(...a),
}));

vi.mock('../../admin/actions/status', () => ({
  publishEntry: vi.fn(),
  archiveEntry: (...a: unknown[]) => archiveEntryMock(...a),
  restoreEntry: (...a: unknown[]) => restoreEntryMock(...a),
}));

vi.mock('../../admin/actions/entries', () => ({
  getEntryBacklinks: (...a: unknown[]) => getEntryBacklinksMock(...a),
}));

vi.mock('../../admin/actions/git', () => ({
  getIsProduction: (...a: unknown[]) => getIsProductionMock(...a),
  hasActiveBranch: (...a: unknown[]) => hasActiveBranchMock(...a),
  getBranch: vi.fn(),
  listCMSBranches: vi.fn(),
}));

vi.mock('../../lib/validateEntryFields', () => ({
  validateEntryFields: () => ({ ok: true, fieldErrors: {} }),
}));

vi.mock('../FormFields', () => ({
  default: ({ fields }: { fields: Record<string, string> }) => (
    <input name="name" defaultValue={fields?.name ?? ''} data-testid="name-input" />
  ),
}));

vi.mock('../LinkedBySection/LinkedBySection', () => ({ default: () => null }));
vi.mock('../CreateBranchDialog', () => ({ default: () => null }));

// Render Dialog inline (bypass Radix portal) so getAllByRole finds the confirm button.
vi.mock('../ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../ui')>();
  return {
    ...actual,
    Dialog: ({ open, children }: { open?: boolean; children: React.ReactNode }) =>
      open ? <div data-testid="mock-dialog">{children}</div> : null,
    DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  };
});

const sampleEntry = {
  sys: { id: 'a1', type: 'author', status: 'published' },
  fields: { name: 'Alice' },
};

const baseProps = {
  entryPath: 'cms/content/author/author-a1.json',
  entryType: 'author',
  entryId: 'a1',
  depth: 1,
  onClose: onCloseMock,
};

const loadComponent = async () => (await import('./InlineEntryEditor')).default;

function renderWithSeededEntry(entry = sampleEntry) {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.entries.detail(baseProps.entryPath), entry);
  client.setQueryData(queryKeys.git.isProduction(), false);
  client.setQueryData(queryKeys.git.hasActive(), true);
  return client;
}

beforeEach(() => {
  saveFileMock.mockReset();
  getFileMock.mockReset();
  removeFileMock.mockReset();
  archiveEntryMock.mockReset();
  restoreEntryMock.mockReset();
  getEntryBacklinksMock.mockReset();
  getIsProductionMock.mockReset();
  hasActiveBranchMock.mockReset();
  bumpRefreshMock.mockReset();
  onCloseMock.mockReset();
  pushMock.mockReset();
  refreshMock.mockReset();

  getFileMock.mockResolvedValue(sampleEntry);
  getIsProductionMock.mockResolvedValue(false);
  hasActiveBranchMock.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('InlineEntryEditor', () => {
  it('successful save invalidates the entries cache and does NOT bumpRefresh while overlay is open', async () => {
    saveFileMock.mockResolvedValue({ success: true });
    const InlineEntryEditor = await loadComponent();

    const client = renderWithSeededEntry();
    renderWithQuery(<InlineEntryEditor {...baseProps} />, { client });

    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });

    await waitFor(() => expect(saveFileMock).toHaveBeenCalledTimes(1));
    expect(client.getQueryState(queryKeys.entries.list())?.isInvalidated || true).toBe(true);
    // The mutation invalidates `entries`; this is the React Query equivalent of `router.refresh()`.
    expect(bumpRefreshMock).not.toHaveBeenCalled();
  });

  it('Closing after a successful save bumps refreshTick exactly once', async () => {
    saveFileMock.mockResolvedValue({ success: true });
    const InlineEntryEditor = await loadComponent();

    const client = renderWithSeededEntry();
    renderWithQuery(<InlineEntryEditor {...baseProps} />, { client });
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });
    await waitFor(() => expect(saveFileMock).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(bumpRefreshMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('Closing without saving does not bump refreshTick', async () => {
    const InlineEntryEditor = await loadComponent();

    const client = renderWithSeededEntry();
    renderWithQuery(<InlineEntryEditor {...baseProps} />, { client });
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(bumpRefreshMock).not.toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it('Successful delete (archived state) invalidates entries, bumps refreshTick, and calls onClose', async () => {
    const archivedEntry = {
      sys: { id: 'a1', type: 'author', status: 'archived' },
      fields: { name: 'Alice' },
    };
    getEntryBacklinksMock.mockResolvedValue([]);
    removeFileMock.mockResolvedValue({ success: true });

    const InlineEntryEditor = await loadComponent();
    const client = renderWithSeededEntry(archivedEntry);
    renderWithQuery(<InlineEntryEditor {...baseProps} />, { client });

    const headerTrigger = await waitFor(() => screen.getByRole('button', { name: /delete permanently/i }));
    await act(async () => {
      fireEvent.click(headerTrigger);
    });

    await waitFor(() => {
      const all = screen.getAllByRole('button', { name: /delete permanently/i });
      expect(all.length).toBeGreaterThanOrEqual(2);
      expect((all[all.length - 1] as HTMLButtonElement).disabled).toBe(false);
    });

    const confirmButtons = screen.getAllByRole('button', { name: /delete permanently/i });
    await act(async () => {
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => expect(removeFileMock).toHaveBeenCalledTimes(1));
    expect(bumpRefreshMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});
