import { describe, expect, it } from 'vitest';

import { normalizeStringListFromStorage, parseStringListFormRaw } from './stringListField';

describe('normalizeStringListFromStorage', () => {
  it('maps arrays to strings', () => {
    expect(normalizeStringListFromStorage(['a', 1])).toEqual(['a', '1']);
  });

  it('returns empty for nullish', () => {
    expect(normalizeStringListFromStorage(null)).toEqual([]);
    expect(normalizeStringListFromStorage(undefined)).toEqual([]);
  });

  it('wraps a single scalar as one item', () => {
    expect(normalizeStringListFromStorage('hello')).toEqual(['hello']);
  });
});

describe('parseStringListFormRaw', () => {
  it('parses JSON array and trims', () => {
    expect(parseStringListFormRaw('[" a ", "b"]')).toEqual({ ok: true, items: ['a', 'b'] });
  });

  it('treats blank raw as empty list', () => {
    expect(parseStringListFormRaw('  ')).toEqual({ ok: true, items: [] });
  });

  it('rejects invalid JSON', () => {
    const r = parseStringListFormRaw('not-json');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('Invalid list data');
  });

  it('rejects non-array JSON', () => {
    const r = parseStringListFormRaw('"only"');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('List field must be a JSON array');
  });

  it('drops empty entries', () => {
    expect(parseStringListFormRaw('["x", "", "  "]')).toEqual({ ok: true, items: ['x'] });
  });
});
