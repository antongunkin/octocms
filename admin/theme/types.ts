/**
 * Shared theme types and constants.
 *
 * No 'use server' / 'use client' directive — safe to import from both Server
 * and Client Components.
 */

export type Theme = 'light' | 'dark';

export const THEME_COOKIE = 'cms-theme';

export const VALID_THEMES: Theme[] = ['light', 'dark'];
