import { describe, expect, it } from 'vitest';

import { JSON_FIELD_MAX_RAW_CHARS, jsonFieldValueToFormString, parseJsonFieldInput } from './jsonField';

const optionalField = { label: 'Payload', format: 'json' as const };
const requiredField = { label: 'Payload', format: 'json' as const, required: true as const };

describe('jsonFieldValueToFormString', () => {
  it('returns empty string for nullish', () => {
    expect(jsonFieldValueToFormString(undefined)).toBe('');
    expect(jsonFieldValueToFormString(null)).toBe('');
  });

  it('passes through strings', () => {
    expect(jsonFieldValueToFormString('{"a":1}')).toBe('{"a":1}');
  });

  it('pretty-prints objects and arrays', () => {
    expect(jsonFieldValueToFormString({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(jsonFieldValueToFormString([1, 2])).toBe('[\n  1,\n  2\n]');
  });
});

describe('parseJsonFieldInput', () => {
  it('optional empty → null', () => {
    expect(parseJsonFieldInput(optionalField, '  ')).toEqual({ ok: true, value: null });
  });

  it('required empty → error', () => {
    const r = parseJsonFieldInput(requiredField, ' \n');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('required');
  });

  it('rejects invalid JSON', () => {
    const r = parseJsonFieldInput(optionalField, '{');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('valid JSON');
  });

  it('accepts object, array, and primitives', () => {
    expect(parseJsonFieldInput(optionalField, '{"x":1}')).toEqual({ ok: true, value: { x: 1 } });
    expect(parseJsonFieldInput(optionalField, '[1]')).toEqual({ ok: true, value: [1] });
    expect(parseJsonFieldInput(optionalField, '"hi"')).toEqual({ ok: true, value: 'hi' });
    expect(parseJsonFieldInput(optionalField, '42')).toEqual({ ok: true, value: 42 });
    expect(parseJsonFieldInput(optionalField, 'true')).toEqual({ ok: true, value: true });
    expect(parseJsonFieldInput(optionalField, 'null')).toEqual({ ok: true, value: null });
  });

  it('rejects raw longer than max', () => {
    const huge = ' '.repeat(JSON_FIELD_MAX_RAW_CHARS) + '{}';
    const r = parseJsonFieldInput(optionalField, huge);
    expect(r.ok).toBe(false);
  });

  it('throws for wrong field format', () => {
    expect(() => parseJsonFieldInput({ label: 'X', format: 'string' } as never, '{}')).toThrow('json');
  });
});
