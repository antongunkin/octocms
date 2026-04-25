import { describe, expect, it } from 'vitest';

import { diffEntryFields, safeParseEntry, stringifyFieldValue } from './entryDiff';

describe('diffEntryFields', () => {
  it('returns an empty object when both sides are null', () => {
    expect(diffEntryFields(null, null)).toEqual({});
  });

  it('marks a field as added when only present on the after side', () => {
    const result = diffEntryFields({ fields: {} }, { fields: { title: 'Hello' } });
    expect(result).toEqual({ title: { kind: 'added', after: 'Hello' } });
  });

  it('marks a field as removed when only present on the before side', () => {
    const result = diffEntryFields({ fields: { title: 'Hello' } }, { fields: {} });
    expect(result).toEqual({ title: { kind: 'removed', before: 'Hello' } });
  });

  it('marks a field as unchanged when both sides are deep-equal', () => {
    const before = { fields: { tags: ['a', 'b'], meta: { x: 1 } } };
    const after = { fields: { tags: ['a', 'b'], meta: { x: 1 } } };
    expect(diffEntryFields(before, after)).toEqual({
      tags: { kind: 'unchanged' },
      meta: { kind: 'unchanged' },
    });
  });

  it('marks a field as changed with before/after payloads when values differ', () => {
    const result = diffEntryFields(
      { fields: { title: 'Old', published: true } },
      { fields: { title: 'New', published: true } },
    );
    expect(result).toEqual({
      title: { kind: 'changed', before: 'Old', after: 'New' },
      published: { kind: 'unchanged' },
    });
  });

  it('detects array-element changes as changed', () => {
    const result = diffEntryFields({ fields: { tags: ['a', 'b'] } }, { fields: { tags: ['a', 'c'] } });
    expect(result).toEqual({
      tags: { kind: 'changed', before: ['a', 'b'], after: ['a', 'c'] },
    });
  });

  it('ignores sys fields', () => {
    const result = diffEntryFields(
      { sys: { id: '1', status: 'draft' }, fields: { title: 'A' } },
      { sys: { id: '1', status: 'changed' }, fields: { title: 'A' } },
    );
    expect(result).toEqual({ title: { kind: 'unchanged' } });
  });

  it('handles missing fields object gracefully', () => {
    expect(diffEntryFields({}, { fields: { a: 1 } })).toEqual({
      a: { kind: 'added', after: 1 },
    });
  });
});

describe('safeParseEntry', () => {
  it('returns null for null/empty input', () => {
    expect(safeParseEntry(null)).toBeNull();
    expect(safeParseEntry('')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(safeParseEntry('not json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(safeParseEntry('[1,2,3]')).toBeNull();
    expect(safeParseEntry('42')).toBeNull();
  });

  it('parses a valid entry JSON', () => {
    expect(safeParseEntry('{"sys":{"id":"1"},"fields":{"title":"Hi"}}')).toEqual({
      sys: { id: '1' },
      fields: { title: 'Hi' },
    });
  });
});

describe('stringifyFieldValue', () => {
  it('returns an empty string for null/undefined', () => {
    expect(stringifyFieldValue(null)).toBe('');
    expect(stringifyFieldValue(undefined)).toBe('');
  });

  it('returns strings as-is', () => {
    expect(stringifyFieldValue('abc')).toBe('abc');
  });

  it('stringifies numbers/booleans', () => {
    expect(stringifyFieldValue(42)).toBe('42');
    expect(stringifyFieldValue(true)).toBe('true');
  });

  it('pretty-prints objects and arrays', () => {
    expect(stringifyFieldValue({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(stringifyFieldValue(['x', 'y'])).toBe('[\n  "x",\n  "y"\n]');
  });
});
