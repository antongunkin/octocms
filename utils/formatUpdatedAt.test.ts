import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatUpdatedAt, formatUpdatedAtFull } from './formatUpdatedAt';

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

  it('formats valid timestamps with short month/day only', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('May 1');
    expect(formatUpdatedAt('2026-05-01T13:41:00.000Z')).toBe('May 1');
  });
});

describe('formatUpdatedAtFull', () => {
  it('returns empty string for missing input', () => {
    expect(formatUpdatedAtFull(undefined)).toBe('');
  });

  it('returns empty string for invalid timestamps', () => {
    expect(formatUpdatedAtFull('not-a-date')).toBe('');
  });

  it('formats valid timestamps with full date and time', () => {
    vi.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('May 1, 2026, 9:41 AM');
    expect(formatUpdatedAtFull('2026-05-01T13:41:00.000Z')).toBe('May 1, 2026, 9:41 AM');
  });
});
