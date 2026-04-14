import { describe, expect, it, vi } from 'vitest';

import { persistedFieldsFromFormStrings } from './persistedFormFields';

const mockConfig = {
  collections: {
    product: {
      label: 'Product',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string' },
        price: { label: 'Price', format: 'number', valueType: 'float' as const },
        startsOn: { label: 'Starts', format: 'datetime', dateOnly: true as const },
        meta: { label: 'Meta', format: 'json' as const },
        tags: { label: 'Tags', format: 'string', list: true as const },
        kind: {
          label: 'Kind',
          format: 'select' as const,
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
        flags: {
          label: 'Flags',
          format: 'select' as const,
          multiple: true as const,
          options: [{ label: 'X', value: 'x' }],
        },
        bio: { label: 'Bio', format: 'text' as const },
        link: { label: 'Link', format: 'url' as const },
        theme: { label: 'Theme', format: 'color' as const },
      },
    },
  },
} as any;

vi.mock('./configStore', () => ({
  getConfig: () => mockConfig,
}));

describe('persistedFieldsFromFormStrings', () => {
  it('leaves unknown collection keys as strings', () => {
    const r = persistedFieldsFromFormStrings('missing', { a: '1' });
    expect(r).toEqual({ a: '1' });
  });

  it('coerces numbers and date-only datetimes', () => {
    const r = persistedFieldsFromFormStrings('product', {
      title: 'X',
      price: '9.5',
      startsOn: '2024-01-15',
    });
    expect(r).toEqual({ title: 'X', price: 9.5, startsOn: '2024-01-15' });
  });

  it('coerces optional empty datetime to null', () => {
    const r = persistedFieldsFromFormStrings('product', {
      title: 'X',
      price: '1',
      startsOn: '  ',
      meta: '  ',
    });
    expect(r.startsOn).toBeNull();
    expect(r.meta).toBeNull();
  });

  it('parses json fields to native values', () => {
    const r = persistedFieldsFromFormStrings('product', {
      title: 'X',
      price: '1',
      startsOn: '2024-01-15',
      meta: '{"a":1}',
      tags: '[" a ", "b"]',
    });
    expect(r.meta).toEqual({ a: 1 });
    expect(r.tags).toEqual(['a', 'b']);
  });

  it('parses select single and multiselect to string and string[]', () => {
    const r = persistedFieldsFromFormStrings('product', {
      kind: 'b',
      flags: '["x"]',
    });
    expect(r.kind).toBe('b');
    expect(r.flags).toEqual(['x']);
  });

  it('trims text and normalizes url and color', () => {
    const r = persistedFieldsFromFormStrings('product', {
      title: 'X',
      price: '1',
      startsOn: '2024-01-15',
      meta: 'null',
      tags: '[]',
      kind: 'a',
      flags: '[]',
      bio: '  line  ',
      link: '  /p  ',
      theme: '#ABC',
    });
    expect(r.bio).toBe('line');
    expect(r.link).toBe('/p');
    expect(r.theme).toBe('#aabbcc');
  });
});
