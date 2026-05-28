import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
});

afterEach(cleanup);

async function renderToaster() {
  const { Toaster } = await import('./Toaster');
  render(<Toaster />);
}

describe('Toaster', () => {
  it('renders no toast items when the queue is empty', async () => {
    await renderToaster();
    expect(document.querySelector('.octo-toast')).toBeNull();
  });

  it('renders toast title and description', async () => {
    const { toast } = await import('../../../hooks/useToast');
    toast({ title: 'Saved', description: 'Your changes were saved.' });
    await renderToaster();

    expect(screen.getByText('Saved')).toBeDefined();
    expect(screen.getByText('Your changes were saved.')).toBeDefined();
  });

  it('close button dismisses the toast', async () => {
    const { toast } = await import('../../../hooks/useToast');
    toast({ title: 'Dismiss me' });
    await renderToaster();

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));

    await waitFor(() => {
      expect(screen.getByRole('status').getAttribute('data-state')).toBe('closed');
    });
  });
});
