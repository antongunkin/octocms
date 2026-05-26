import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './Dialog';

afterEach(cleanup);

// ── Helpers ───────────────────────────────────────────────────────────────────

function BasicDialog({
  open,
  defaultOpen,
  onOpenChange,
}: {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
      <DialogTrigger>Open</DialogTrigger>
      <DialogContent>
        <DialogTitle>My Dialog</DialogTitle>
        <DialogDescription>A description</DialogDescription>
        <DialogFooter>
          <DialogClose data-testid="dialog-close-btn">Dismiss</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Controlled open ──────────────────────────────────────────────────────────

describe('Dialog — controlled open', () => {
  it('renders the dialog element in the DOM when open', () => {
    render(<BasicDialog open />);
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('dialog has data-state="open" when open', () => {
    render(<BasicDialog open />);
    expect(screen.getByRole('dialog').getAttribute('data-state')).toBe('open');
  });

  it('does not render dialog content when closed', () => {
    render(<BasicDialog open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByText('My Dialog')).toBeNull();
  });
});

// ── Trigger ───────────────────────────────────────────────────────────────────

describe('Dialog — trigger', () => {
  it('clicking DialogTrigger opens the dialog', () => {
    render(<BasicDialog defaultOpen={false} />);
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('clicking DialogTrigger calls onOpenChange(true)', () => {
    const onOpenChange = vi.fn();
    render(<BasicDialog onOpenChange={onOpenChange} />);
    fireEvent.click(screen.getByText('Open'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
});

// ── DialogClose ───────────────────────────────────────────────────────────────

describe('Dialog — close button', () => {
  it('clicking DialogClose closes the dialog', async () => {
    render(<BasicDialog defaultOpen />);
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(screen.getByTestId('dialog-close-btn'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('clicking the X icon close button calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<BasicDialog open onOpenChange={onOpenChange} />);
    const closeBtn = screen.getByLabelText('Close');
    fireEvent.click(closeBtn);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ── ESC key ───────────────────────────────────────────────────────────────────

describe('Dialog — ESC key', () => {
  it('pressing Escape calls onOpenChange(false)', () => {
    const onOpenChange = vi.fn();
    render(<BasicDialog open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ── Backdrop click ────────────────────────────────────────────────────────────

describe('Dialog — backdrop click', () => {
  it('calls onOpenChange(false) when clicking the backdrop (target is dialog element)', () => {
    const onOpenChange = vi.fn();
    render(<BasicDialog open onOpenChange={onOpenChange} />);
    const dialog = document.querySelector('dialog')!;
    // Simulate backdrop click: fireEvent.click on the <dialog> itself sets e.target === dialog
    fireEvent.click(dialog);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('does not close when clicking inside the dialog content', () => {
    const onOpenChange = vi.fn();
    render(<BasicDialog open onOpenChange={onOpenChange} />);
    const title = screen.getByText('My Dialog');
    fireEvent.click(title);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});

// ── Sub-components ────────────────────────────────────────────────────────────

describe('Dialog — sub-components', () => {
  it('DialogTitle renders with octo-dialog__title class', () => {
    render(<BasicDialog open />);
    expect(screen.getByText('My Dialog').className).toContain('octo-dialog__title');
  });

  it('DialogDescription renders with octo-dialog__description class', () => {
    render(<BasicDialog open />);
    expect(screen.getByText('A description').className).toContain('octo-dialog__description');
  });

  it('DialogHeader renders with octo-dialog__header class', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader data-testid="hdr">
            <DialogTitle>T</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByTestId('hdr').className).toContain('octo-dialog__header');
  });

  it('DialogFooter renders with octo-dialog__footer class', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>T</DialogTitle>
          <DialogFooter data-testid="ftr">
            <button>OK</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>,
    );
    expect(screen.getByTestId('ftr').className).toContain('octo-dialog__footer');
  });

  it('DialogContent has octo-dialog__content class', () => {
    render(<BasicDialog open />);
    expect(screen.getByRole('dialog').className).toContain('octo-dialog__content');
  });
});

// ── aria ──────────────────────────────────────────────────────────────────────

describe('Dialog — accessibility', () => {
  it('dialog has aria-modal="true"', () => {
    render(<BasicDialog open />);
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true');
  });

  it('dialog is labelled by its title', () => {
    render(<BasicDialog open />);
    const dialog = screen.getByRole('dialog');
    const title = screen.getByText('My Dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe(title.id);
  });

  it('dialog is described by its description', () => {
    render(<BasicDialog open />);
    const dialog = screen.getByRole('dialog');
    const desc = screen.getByText('A description');
    expect(dialog.getAttribute('aria-describedby')).toBe(desc.id);
  });
});

// ── uncontrolled / defaultOpen ────────────────────────────────────────────────

describe('Dialog — uncontrolled', () => {
  it('opens on trigger click with no controlled state', () => {
    render(<BasicDialog />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByRole('dialog')).toBeDefined();
  });

  it('closes via DialogClose with no controlled state', async () => {
    render(<BasicDialog defaultOpen />);
    expect(screen.getByRole('dialog')).toBeDefined();
    fireEvent.click(screen.getByTestId('dialog-close-btn'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
