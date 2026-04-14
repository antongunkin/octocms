/**
 * Shared theme types and constants.
 *
 * This file has NO 'use server' / 'use client' directive so it can be safely
 * imported by both Server Components and Client Components.
 */

export type Theme = 'light' | 'dark' | 'system';

export const THEME_COOKIE = 'cms-theme';

export const VALID_THEMES: Theme[] = ['light', 'dark', 'system'];
