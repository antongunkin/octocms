'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

import type { Theme } from './theme';
import { THEME_COOKIE } from './theme';

type ThemeContextValue = {
  /** The stored preference: 'light' | 'dark' | 'system' */
  theme: Theme;
  /** The applied theme after resolving 'system' via matchMedia */
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'light',
  setTheme: () => {},
});

/**
 * Hook to access the current theme state and setter from anywhere inside the CMS.
 */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

type ThemeProviderProps = {
  /**
   * Initial theme value from the SSR-read cookie. Passed from AdminLayout
   * so the first render already has the correct theme without a hydration flash
   * for users with an explicit 'light' or 'dark' cookie.
   */
  initialTheme: Theme;
  children: React.ReactNode;
};

/**
 * Provides theme state for the CMS admin panel.
 *
 * - Resolves 'system' by listening to `prefers-color-scheme`.
 * - Persists the preference to the `cms-theme` cookie (SameSite=Lax, 1 year).
 * - Syncs `class="dark"` onto `document.body` so that Radix UI portal
 *   elements (dropdowns, dialogs) — which are appended to `<body>` — also
 *   inherit the dark CSS variable scope.
 *
 * This provider is only mounted inside `src/app/cms/layout.tsx`, so the
 * `document.body` class never leaks to public pages.
 */
export function ThemeProvider({ initialTheme, children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(initialTheme);
  const [systemDark, setSystemDark] = useState(false);

  // Detect system preference on the client and track changes.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);

    const handler = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const resolvedTheme: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme;

  // Sync dark class to document.body so Radix portals inherit the dark scope.
  // Safe: ThemeProvider is only mounted under /cms, never on public pages.
  // The cleanup removes the class when the CMS layout unmounts (e.g. navigating
  // from /cms to a public route via client-side navigation).
  useEffect(() => {
    document.body.classList.toggle('dark', resolvedTheme === 'dark');
    return () => {
      document.body.classList.remove('dark');
    };
  }, [resolvedTheme]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    // Persist to cookie for SSR reads on next page load.
    document.cookie = `${THEME_COOKIE}=${next};path=/;max-age=31536000;SameSite=Lax`;
  }, []);

  return <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>{children}</ThemeContext.Provider>;
}
