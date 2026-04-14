import { act, render, renderHook, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider, useTheme } from './ThemeProvider';

// ---------------------------------------------------------------------------
// matchMedia mock — must be set before ThemeProvider mounts.
// ---------------------------------------------------------------------------
function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((e: Partial<MediaQueryListEvent>) => void)[] = [];

  const mq = {
    matches: prefersDark,
    addEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      listeners.push(fn);
    }),
    removeEventListener: vi.fn((_: string, fn: (e: Partial<MediaQueryListEvent>) => void) => {
      const idx = listeners.indexOf(fn);
      if (idx !== -1) listeners.splice(idx, 1);
    }),
    // Helper to simulate system preference change in tests
    _emit: (matches: boolean) => {
      listeners.forEach((fn) => fn({ matches }));
    },
  };

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn(() => mq),
  });

  return mq;
}

// ---------------------------------------------------------------------------
// Wrapper helper
// ---------------------------------------------------------------------------
function wrapper(initialTheme: 'light' | 'dark' | 'system') {
  return ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
  );
}

beforeEach(() => {
  // Reset document.body classes between tests
  document.body.className = '';
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.className = '';
});

describe('ThemeProvider', () => {
  it('renders children', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider initialTheme="light">
        <span>hello</span>
      </ThemeProvider>,
    );
    expect(screen.getByText('hello')).toBeTruthy();
  });

  describe('resolvedTheme', () => {
    it('is "light" when initialTheme is "light"', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('light') });
      expect(result.current.resolvedTheme).toBe('light');
    });

    it('is "dark" when initialTheme is "dark"', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('is "dark" when initialTheme is "system" and system prefers dark', async () => {
      mockMatchMedia(true);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('system') });
      // useEffect runs after render; wait for state update
      await act(async () => {});
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('is "light" when initialTheme is "system" and system prefers light', async () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('system') });
      await act(async () => {});
      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  describe('setTheme', () => {
    it('updates theme state', async () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('light') });
      act(() => {
        result.current.setTheme('dark');
      });
      expect(result.current.theme).toBe('dark');
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('writes to document.cookie', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('light') });
      act(() => {
        result.current.setTheme('dark');
      });
      expect(document.cookie).toContain('cms-theme=dark');
    });

    it('switches back to light', () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
      act(() => {
        result.current.setTheme('light');
      });
      expect(result.current.resolvedTheme).toBe('light');
    });
  });

  describe('document.body dark class', () => {
    it('adds dark class when resolvedTheme is dark', async () => {
      mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
      await act(async () => {});
      expect(result.current.resolvedTheme).toBe('dark');
      expect(document.body.classList.contains('dark')).toBe(true);
    });

    it('does not add dark class when resolvedTheme is light', async () => {
      mockMatchMedia(false);
      renderHook(() => useTheme(), { wrapper: wrapper('light') });
      await act(async () => {});
      expect(document.body.classList.contains('dark')).toBe(false);
    });

    it('removes dark class on unmount', async () => {
      mockMatchMedia(false);
      const { unmount } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
      await act(async () => {});
      expect(document.body.classList.contains('dark')).toBe(true);
      unmount();
      expect(document.body.classList.contains('dark')).toBe(false);
    });
  });

  describe('system preference change', () => {
    it('resolvedTheme updates when system changes to dark', async () => {
      const mq = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('system') });
      await act(async () => {});
      expect(result.current.resolvedTheme).toBe('light');

      await act(async () => {
        mq._emit(true);
      });
      expect(result.current.resolvedTheme).toBe('dark');
    });

    it('resolvedTheme does not respond to system changes when theme is explicitly set', async () => {
      const mq = mockMatchMedia(false);
      const { result } = renderHook(() => useTheme(), { wrapper: wrapper('dark') });
      await act(async () => {});
      expect(result.current.resolvedTheme).toBe('dark');

      // System changes to light — explicit 'dark' should be unaffected
      await act(async () => {
        mq._emit(false);
      });
      expect(result.current.resolvedTheme).toBe('dark');
    });
  });
});
