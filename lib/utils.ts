import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx — the standard utility for Radix UI + Tailwind components.
 * Handles conditional classes, deduplication, and conflict resolution.
 *
 * @example
 *   cn('px-4 py-2', isActive && 'bg-primary text-primary-foreground', className)
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
