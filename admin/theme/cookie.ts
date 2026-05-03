'use server';

import { cookies } from 'next/headers';

import type { Theme } from './types';
import { THEME_COOKIE, VALID_THEMES } from './types';

/**
 * Server action — reads the `cms-theme` cookie. Falls back to `'dark'`
 * (the default theme) when the cookie is absent or invalid.
 */
export async function getThemeCookie(): Promise<Theme> {
  const value = (await cookies()).get(THEME_COOKIE)?.value;
  return VALID_THEMES.includes(value as Theme) ? (value as Theme) : 'dark';
}
