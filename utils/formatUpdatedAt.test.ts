import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatUpdatedAt } from './formatUpdatedAt';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('formatUpdatedAt', () => {
  it('returns an em dash for missing input', () => {
    expect(formatUpdatedAt(undefined)).toBe('—');
  });

  it('returns an em dash for invalid timestamps', () => {
    expect(formatUpdatedAt('not-a-date')).toBe('—');
  });

  it('formats valid timestamps with month/day and time', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('May 1, 9:41 AM');
    expect(formatUpdatedAt('2026-05-01T13:41:00.000Z')).toBe('May 1, 9:41 AM');
  });
});
