import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { relativeTime } from './relativeTime';

const NOW = new Date('2026-04-17T12:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('relativeTime', () => {
  it('returns empty string for empty input', () => {
    expect(relativeTime('')).toBe('');
  });

  it('returns "Just now" for diffs under 2 minutes', () => {
    const iso = new Date(NOW.getTime() - 30 * 1000).toISOString();
    expect(relativeTime(iso)).toBe('Just now');
  });

  it('returns minute-precision for diffs under an hour', () => {
    const iso = new Date(NOW.getTime() - 5 * 60 * 1000).toISOString();
    expect(relativeTime(iso)).toBe('5 minutes ago');
  });

  it('returns hour-precision for diffs under a day', () => {
    const iso = new Date(NOW.getTime() - 3 * 60 * 60 * 1000).toISOString();
    expect(relativeTime(iso)).toBe('3 hours ago');
  });

  it('returns day-precision for diffs under 30 days', () => {
    const iso = new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(relativeTime(iso)).toBe('5 days ago');
  });

  it('falls back to a formatted date for diffs of 30 days or more', () => {
    const iso = new Date(NOW.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const result = relativeTime(iso);
    // Matches e.g. "Feb 16, 2026"
    expect(result).toMatch(/^\w{3} \d{1,2}, \d{4}$/);
  });
});
