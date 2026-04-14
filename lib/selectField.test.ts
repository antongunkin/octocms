import { describe, expect, it } from 'vitest';

import { parseSelectFieldInput } from './selectField';

const singleField = {
  label: 'Color',
  format: 'select' as const,
  options: [
    { label: 'Blue', value: 'blue' },
    { label: 'Red', value: 'red' },
  ],
};

const multiField = {
  label: 'Tags',
  format: 'select' as const,
  multiple: true as const,
  options: [
    { label: 'A', value: 'a' },
    { label: 'B', value: 'b' },
  ],
};

describe('parseSelectFieldInput', () => {
  it('parses optional empty single as empty string', () => {
    const r = parseSelectFieldInput(singleField, '');
    expect(r).toEqual({ ok: true, value: '' });
  });

  it('rejects invalid single value', () => {
    const r = parseSelectFieldInput(singleField, 'green');
    expect(r).toEqual({ ok: false, message: 'Color has an invalid choice' });
  });

  it('parses valid single value', () => {
    const r = parseSelectFieldInput(singleField, 'red');
    expect(r).toEqual({ ok: true, value: 'red' });
  });

  it('requires non-empty when required single', () => {
    const r = parseSelectFieldInput({ ...singleField, required: true }, '');
    expect(r).toEqual({ ok: false, message: 'Color is required' });
  });

  it('parses multiselect JSON array', () => {
    const r = parseSelectFieldInput(multiField, '["a","b"]');
    expect(r).toEqual({ ok: true, value: ['a', 'b'] });
  });

  it('parses empty optional multiselect', () => {
    const r = parseSelectFieldInput(multiField, '');
    expect(r).toEqual({ ok: true, value: [] });
  });

  it('rejects required empty multiselect', () => {
    const r = parseSelectFieldInput({ ...multiField, required: true }, '');
    expect(r).toEqual({ ok: false, message: 'Tags is required' });
  });

  it('rejects required multiselect with empty array', () => {
    const r = parseSelectFieldInput({ ...multiField, required: true }, '[]');
    expect(r).toEqual({ ok: false, message: 'Tags is required' });
  });
});
