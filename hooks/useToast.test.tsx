import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { reducer, toast, useToast } from './useToast';

afterEach(cleanup);

// ── reducer (pure) ────────────────────────────────────────────────────────────

describe('reducer', () => {
  it('ADD_TOAST prepends a toast', () => {
    const state = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'Hi' } });
    expect(state.toasts).toHaveLength(1);
    expect(state.toasts[0].id).toBe('1');
  });

  it('ADD_TOAST respects TOAST_LIMIT (max 1)', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'A' } });
    const s2 = reducer(s1, { type: 'ADD_TOAST', toast: { id: '2', title: 'B' } });
    expect(s2.toasts).toHaveLength(1);
    expect(s2.toasts[0].id).toBe('2');
  });

  it('UPDATE_TOAST merges fields', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'Old' } });
    const s2 = reducer(s1, { type: 'UPDATE_TOAST', toast: { id: '1', title: 'New' } });
    expect(s2.toasts[0].title).toBe('New');
  });

  it('DISMISS_TOAST sets open:false on the target', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'A', open: true } });
    const s2 = reducer(s1, { type: 'DISMISS_TOAST', toastId: '1' });
    expect(s2.toasts[0].open).toBe(false);
  });

  it('DISMISS_TOAST without id dismisses all', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'A', open: true } });
    const s2 = reducer(s1, { type: 'DISMISS_TOAST' });
    expect(s2.toasts[0].open).toBe(false);
  });

  it('REMOVE_TOAST removes by id', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'A' } });
    const s2 = reducer(s1, { type: 'REMOVE_TOAST', toastId: '1' });
    expect(s2.toasts).toHaveLength(0);
  });

  it('REMOVE_TOAST without id clears all', () => {
    const s1 = reducer({ toasts: [] }, { type: 'ADD_TOAST', toast: { id: '1', title: 'A' } });
    const s2 = reducer(s1, { type: 'REMOVE_TOAST' });
    expect(s2.toasts).toHaveLength(0);
  });
});

// ── toast() ───────────────────────────────────────────────────────────────────

describe('toast()', () => {
  it('returns { id, dismiss, update }', () => {
    const t = toast({ title: 'X' });
    expect(typeof t.id).toBe('string');
    expect(typeof t.dismiss).toBe('function');
    expect(typeof t.update).toBe('function');
  });

  it('populates memoryState so useToast() renders immediately on mount', () => {
    toast({ title: 'pre-mount-toast' });
    const { result } = renderHook(() => useToast());
    // useState initialises from memoryState synchronously
    const found = result.current.toasts.find((t) => t.title === 'pre-mount-toast');
    expect(found).toBeDefined();
  });

  it('t.dismiss() sets open to false on the toast', async () => {
    const t = toast({ title: 'dismiss-test' });
    const { result } = renderHook(() => useToast());
    t.dismiss();
    await waitFor(() => expect(result.current.toasts.find((x) => x.id === t.id)?.open).toBe(false));
  });

  it('useToast().dismiss(id) sets open to false on the toast', async () => {
    const t = toast({ title: 'dismiss-by-id' });
    const { result } = renderHook(() => useToast());
    act(() => result.current.dismiss(t.id));
    await waitFor(() => expect(result.current.toasts.find((x) => x.id === t.id)?.open).toBe(false));
  });

  it('toast removed from state after TOAST_REMOVE_DELAY', () => {
    vi.useFakeTimers();
    try {
      const t = toast({ title: 'timed-removal' });
      const { result } = renderHook(() => useToast());
      act(() => {
        t.dismiss();
        vi.advanceTimersByTime(1100);
      });
      expect(result.current.toasts.find((x) => x.id === t.id)).toBeUndefined();
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── Toaster integration ───────────────────────────────────────────────────────
// Toast is called before render so memoryState is pre-populated; the component
// initialises synchronously without needing to wait for an effect → listener cycle.

describe('Toaster integration', () => {
  function TestApp() {
    const { toasts } = useToast();
    return (
      <ul>
        {toasts.map((t) => (
          <li key={t.id} data-testid={`toast-${t.id}`} data-state={t.open ? 'open' : 'closed'}>
            {t.title}
            <button onClick={() => t.dismiss?.()}>close</button>
          </li>
        ))}
      </ul>
    );
  }

  it('renders the toast that was enqueued before mount', () => {
    const t = toast({ title: 'pre-render-toast' });
    render(<TestApp />);
    expect(screen.getByText('pre-render-toast')).toBeDefined();
    expect(document.querySelector(`[data-testid="toast-${t.id}"]`)).not.toBeNull();
  });

  it('toast item has data-state="open"', () => {
    const t = toast({ title: 'open-state-toast' });
    render(<TestApp />);
    expect(document.querySelector(`[data-testid="toast-${t.id}"]`)?.getAttribute('data-state')).toBe('open');
  });

  it('clicking dismiss sets data-state="closed"', async () => {
    const t = toast({ title: 'closeable-toast' });
    render(<TestApp />);
    fireEvent.click(screen.getByRole('button', { name: 'close' }));
    await waitFor(() => {
      expect(document.querySelector(`[data-testid="toast-${t.id}"]`)?.getAttribute('data-state')).toBe('closed');
    });
  });
});
