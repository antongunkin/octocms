import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refresh = vi.fn();
const push = vi.fn();
const back = vi.fn();
const replace = vi.fn();
const bumpRefresh = vi.fn();
const onClose = vi.fn();

const {
  saveFile,
  getFile,
  removeFile,
  publishEntry,
  archiveEntry,
  restoreEntry,
  getEntryBacklinks,
  getIsProduction,
  hasActiveBranch,
} = vi.hoisted(() => ({
  saveFile: vi.fn(),
  getFile: vi.fn(),
  removeFile: vi.fn(),
  publishEntry: vi.fn(),
  archiveEntry: vi.fn(),
  restoreEntry: vi.fn(),
  getEntryBacklinks: vi.fn(),
  getIsProduction: vi.fn(),
  hasActiveBranch: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh, push, back, replace }),
}));

vi.mock('../../hooks/useEntryStack', () => ({
  useEntryStack: () => ({
    stack: [],
    pushEntry: vi.fn(),
    popEntry: vi.fn(),
    closeAll: vi.fn(),
    ancestorPaths: new Set<string>(),
    refreshTick: 0,
    bumpRefresh,
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

vi.mock('../../hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('../../admin/actions', () => ({
  saveFile,
  getFile,
  removeFile,
  publishEntry,
  archiveEntry,
  restoreEntry,
  getEntryBacklinks,
  getIsProduction,
  hasActiveBranch,
}));

vi.mock('../../lib/validateEntryFields', () => ({
  validateEntryFields: () => ({ ok: true, fieldErrors: {} }),
}));

// Stub FormFields and the sidebar bits so we exercise only the close/save/delete plumbing.
vi.mock('../FormFields', () => ({
  default: ({ fields }: { fields: Record<string, string> }) => (
    <input name="name" defaultValue={fields?.name ?? ''} data-testid="name-input" />
  ),
}));

vi.mock('../LinkedBySection/LinkedBySection', () => ({
  default: () => null,
}));

vi.mock('../CreateBranchDialog', () => ({
  default: () => null,
}));

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
  onClose,
};

const loadComponent = async () => (await import('./InlineEntryEditor')).default;

beforeEach(() => {
  refresh.mockReset();
  push.mockReset();
  back.mockReset();
  replace.mockReset();
  bumpRefresh.mockReset();
  onClose.mockReset();
  saveFile.mockReset();
  getFile.mockReset();
  removeFile.mockReset();
  publishEntry.mockReset();
  archiveEntry.mockReset();
  restoreEntry.mockReset();
  getEntryBacklinks.mockReset();
  getIsProduction.mockReset();
  hasActiveBranch.mockReset();

  getFile.mockResolvedValue(sampleEntry);
  getIsProduction.mockResolvedValue(false);
  hasActiveBranch.mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('InlineEntryEditor', () => {
  it('successful save calls router.refresh() and does NOT bumpRefresh while overlay is open', async () => {
    saveFile.mockResolvedValue({ success: true });
    const InlineEntryEditor = await loadComponent();

    render(<InlineEntryEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });

    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bumpRefresh).not.toHaveBeenCalled();
  });

  it('Closing after a successful save bumps refreshTick exactly once', async () => {
    saveFile.mockResolvedValue({ success: true });
    const InlineEntryEditor = await loadComponent();

    render(<InlineEntryEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });
    await waitFor(() => expect(saveFile).toHaveBeenCalled());

    // Click Back
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(bumpRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Closing without saving does not bump refreshTick', async () => {
    const InlineEntryEditor = await loadComponent();

    render(<InlineEntryEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(bumpRefresh).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Successful delete (archived state) calls router.refresh, bumpRefresh, and onClose', async () => {
    getFile.mockResolvedValue({
      sys: { id: 'a1', type: 'author', status: 'archived' },
      fields: { name: 'Alice' },
    });
    getEntryBacklinks.mockResolvedValue([]);
    removeFile.mockResolvedValue({ success: true });
    const InlineEntryEditor = await loadComponent();

    render(<InlineEntryEditor {...baseProps} />);

    // Wait for the header trigger to mount (only one "Delete permanently" button exists yet).
    const headerTrigger = await waitFor(() => screen.getByRole('button', { name: /delete permanently/i }));
    await act(async () => {
      fireEvent.click(headerTrigger);
    });

    // Dialog opens and backlinks resolve → confirm button becomes enabled.
    await waitFor(() => {
      const all = screen.getAllByRole('button', { name: /delete permanently/i });
      expect(all.length).toBeGreaterThanOrEqual(2);
      // The dialog confirm is the second one and must be enabled.
      expect((all[all.length - 1] as HTMLButtonElement).disabled).toBe(false);
    });

    const confirmButtons = screen.getAllByRole('button', { name: /delete permanently/i });
    await act(async () => {
      fireEvent.click(confirmButtons[confirmButtons.length - 1]);
    });

    await waitFor(() => expect(removeFile).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bumpRefresh).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Does not dispatch any cms:entry-saved or cms:entry-deleted window events', async () => {
    saveFile.mockResolvedValue({ success: true });
    removeFile.mockResolvedValue({ success: true });
    getFile.mockResolvedValue({
      sys: { id: 'a1', type: 'author', status: 'archived' },
      fields: { name: 'Alice' },
    });
    getEntryBacklinks.mockResolvedValue([]);

    const InlineEntryEditor = await loadComponent();

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<InlineEntryEditor {...baseProps} />);
    await waitFor(() => expect(screen.getByTestId('name-input')).toBeTruthy());

    await act(async () => {
      fireEvent.submit(document.querySelector('form')!);
    });
    await waitFor(() => expect(saveFile).toHaveBeenCalled());

    const buses = dispatchSpy.mock.calls
      .map(([e]) => (e as Event).type)
      .filter((t) => t === 'cms:entry-saved' || t === 'cms:entry-deleted');
    expect(buses).toEqual([]);

    dispatchSpy.mockRestore();
  });
});
