import { describe, expect, it } from 'vitest';

import { parseNumberFieldInput } from './numberField';

const base = { label: 'N', format: 'number' as const };

describe('parseNumberFieldInput', () => {
  it('accepts optional empty as null', () => {
    expect(parseNumberFieldInput({ ...base, required: false }, '  ')).toEqual({ ok: true, value: null });
  });

  it('rejects empty when required', () => {
    const r = parseNumberFieldInput({ ...base, required: true }, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('N is required');
  });

  it('parses float', () => {
    expect(parseNumberFieldInput({ ...base, valueType: 'float' }, '3.14')).toEqual({ ok: true, value: 3.14 });
  });

  it('stores ints without fractional input', () => {
    expect(parseNumberFieldInput({ ...base, valueType: 'int' }, '9')).toEqual({ ok: true, value: 9 });
    expect(parseNumberFieldInput({ ...base, valueType: 'int' }, '9.0')).toEqual({ ok: true, value: 9 });
  });

  it('rejects non-integer for int', () => {
    const r = parseNumberFieldInput({ ...base, valueType: 'int' }, '2.5');
    expect(r.ok).toBe(false);
  });

  it('enforces min and max', () => {
    const r1 = parseNumberFieldInput({ ...base, min: 0, max: 10 }, '-1');
    expect(r1.ok).toBe(false);
    const r2 = parseNumberFieldInput({ ...base, min: 0, max: 10 }, '11');
    expect(r2.ok).toBe(false);
  });
});
