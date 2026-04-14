import { describe, expect, it } from 'vitest';

import {
  formInputToStoredIso,
  parseDatetimeFieldInput,
  storedDatetimeToFormInput,
  toDateInputValue,
  toDatetimeLocalValue,
} from './datetimeField';

const dt = { label: 'When', format: 'datetime' as const };
const dtReq = { ...dt, required: true as const };
const dtDateOnly = { ...dt, dateOnly: true as const };

describe('toDatetimeLocalValue / toDateInputValue', () => {
  it('formats a known UTC instant in local components', () => {
    const d = new Date('2024-06-15T14:30:00Z');
    expect(toDatetimeLocalValue(d)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    expect(toDateInputValue(d)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('storedDatetimeToFormInput', () => {
  it('maps full ISO to a local datetime-local string', () => {
    const s = storedDatetimeToFormInput('2024-01-10T15:00:00.000Z', false);
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });

  it('passes through date-only storage when dateOnly', () => {
    expect(storedDatetimeToFormInput('2024-05-20', true)).toBe('2024-05-20');
  });

  it('returns empty for blank or invalid', () => {
    expect(storedDatetimeToFormInput('', false)).toBe('');
    expect(storedDatetimeToFormInput('not-a-date', false)).toBe('');
  });
});

describe('formInputToStoredIso', () => {
  it('stores date-only as YYYY-MM-DD', () => {
    expect(formInputToStoredIso('2022-11-03', true)).toBe('2022-11-03');
  });

  it('rejects malformed date-only', () => {
    expect(() => formInputToStoredIso('2022-13-40', true)).toThrow();
  });
});

describe('parseDatetimeFieldInput', () => {
  it('allows optional empty as null', () => {
    expect(parseDatetimeFieldInput(dt, '  ')).toEqual({ ok: true, value: null });
  });

  it('rejects empty when required', () => {
    const r = parseDatetimeFieldInput(dtReq, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toBe('When is required');
  });

  it('accepts date-only input', () => {
    expect(parseDatetimeFieldInput(dtDateOnly, '2020-01-02')).toEqual({ ok: true, value: '2020-01-02' });
  });

  it('accepts datetime-local and returns ISO', () => {
    const r = parseDatetimeFieldInput(dt, '2020-01-02T08:00');
    expect(r.ok).toBe(true);
    if (r.ok && r.value) {
      expect(r.value).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(Number.isNaN(new Date(r.value).getTime())).toBe(false);
    }
  });

  it('rejects invalid input', () => {
    const r = parseDatetimeFieldInput(dtDateOnly, 'nope');
    expect(r.ok).toBe(false);
  });
});
