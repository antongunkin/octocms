import { describe, expect, it } from 'vitest';

import { normalizeHexColor, parseColorFieldInput } from './colorField';

const optional = { label: 'Theme', required: false as boolean | undefined };
const required = { label: 'Theme', required: true };

describe('normalizeHexColor', () => {
  it('normalizes 6-digit and 3-digit hex', () => {
    expect(normalizeHexColor('#aABBcc')).toBe('#aabbcc');
    expect(normalizeHexColor('#abc')).toBe('#aabbcc');
  });

  it('returns null for invalid input', () => {
    expect(normalizeHexColor('')).toBeNull();
    expect(normalizeHexColor('blue')).toBeNull();
    expect(normalizeHexColor('#gg0000')).toBeNull();
    expect(normalizeHexColor('#12')).toBeNull();
  });
});

describe('parseColorFieldInput', () => {
  it('normalizes valid hex', () => {
    expect(parseColorFieldInput(optional, '#fff')).toEqual({ ok: true, value: '#ffffff' });
    expect(parseColorFieldInput(optional, '#336699')).toEqual({ ok: true, value: '#336699' });
  });

  it('rejects invalid colors', () => {
    expect(parseColorFieldInput(optional, 'red').ok).toBe(false);
    expect(parseColorFieldInput(optional, '#gggggg').ok).toBe(false);
  });

  it('handles required vs optional empty', () => {
    expect(parseColorFieldInput(optional, '')).toEqual({ ok: true, value: '' });
    expect(parseColorFieldInput(optional, '  ')).toEqual({ ok: true, value: '' });
    expect(parseColorFieldInput(required, '').ok).toBe(false);
  });
});
