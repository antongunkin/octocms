import { describe, expect, it } from 'vitest';

import { parseUrlFieldInput } from './urlField';

const optional = { label: 'Link', required: false as boolean | undefined };
const required = { label: 'Link', required: true };

describe('parseUrlFieldInput', () => {
  it('accepts https and http URLs', () => {
    expect(parseUrlFieldInput(optional, 'https://example.com/x')).toEqual({
      ok: true,
      value: 'https://example.com/x',
    });
    expect(parseUrlFieldInput(optional, 'http://a.b/')).toEqual({ ok: true, value: 'http://a.b/' });
  });

  it('accepts root-relative paths', () => {
    expect(parseUrlFieldInput(optional, '/foo')).toEqual({ ok: true, value: '/foo' });
    expect(parseUrlFieldInput(optional, '/')).toEqual({ ok: true, value: '/' });
  });

  it('rejects protocol-relative and other schemes', () => {
    expect(parseUrlFieldInput(optional, '//cdn.example/x').ok).toBe(false);
    expect(parseUrlFieldInput(optional, 'ftp://x').ok).toBe(false);
    expect(parseUrlFieldInput(optional, 'foo').ok).toBe(false);
    expect(parseUrlFieldInput(optional, 'relative').ok).toBe(false);
  });

  it('trims whitespace', () => {
    expect(parseUrlFieldInput(optional, '  https://x  ')).toEqual({ ok: true, value: 'https://x' });
  });

  it('handles required vs optional empty', () => {
    expect(parseUrlFieldInput(optional, '')).toEqual({ ok: true, value: '' });
    expect(parseUrlFieldInput(optional, '  ')).toEqual({ ok: true, value: '' });
    expect(parseUrlFieldInput(required, '').ok).toBe(false);
    expect(parseUrlFieldInput(required, '  ').ok).toBe(false);
  });
});
