'use server';

import { cookies } from 'next/headers';

import { THEME_COOKIE, VALID_THEMES } from '../theme';
import type { Theme } from '../theme';

/**
 * Server action — reads the `cms-theme` cookie and returns the stored
 * preference. Falls back to `'system'` when absent or invalid.
 *
 * Imported only by Server Components (e.g. AdminLayout).
 */
export async function getThemeCookie(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return VALID_THEMES.includes(value as Theme) ? (value as Theme) : 'system';
}
