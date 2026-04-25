import { describe, expect, it } from 'vitest';

import type { CollectionField } from '../../types';
import { draftToField, emptyDraft, fieldToDraft, reorderFields } from './fieldOptions';

describe('emptyDraft', () => {
  it('returns sensible defaults per format', () => {
    expect(emptyDraft('string')).toMatchObject({ format: 'string', searchable: true });
    expect(emptyDraft('reference').options).toMatchObject({ cardinality: 'many', collections: [] });
    expect(emptyDraft('select').options).toMatchObject({ multiple: false, options: [] });
  });
});

describe('draftToField', () => {
  it('emits a minimal string field', () => {
    const draft = { ...emptyDraft('string'), label: 'Title', key: 'title' };
    expect(draftToField(draft)).toEqual({ label: 'Title', format: 'string' });
  });

  it('round-trips a list-of-strings field', () => {
    const draft = { ...emptyDraft('string'), label: 'Tags', key: 'tags', options: { list: true } };
    expect(draftToField(draft)).toEqual({ label: 'Tags', format: 'string', list: true });
  });

  it('emits text rows when set', () => {
    const draft = { ...emptyDraft('text'), label: 'Body', key: 'body', options: { rows: 8 } };
    expect(draftToField(draft)).toMatchObject({ format: 'text', rows: 8 });
  });

  it('preserves required and entryTitle flags', () => {
    const draft = {
      ...emptyDraft('string'),
      label: 'Title',
      key: 'title',
      required: true,
      entryTitle: true,
    };
    const f = draftToField(draft);
    expect(f.required).toBe(true);
    expect(f.entryTitle).toBe(true);
  });

  it('persists searchable: false but omits the default true', () => {
    const enabled = draftToField({ ...emptyDraft('string'), label: 'L', key: 'k', searchable: true });
    expect((enabled as { searchable?: boolean }).searchable).toBeUndefined();

    const disabled = draftToField({ ...emptyDraft('string'), label: 'L', key: 'k', searchable: false });
    expect((disabled as { searchable?: boolean }).searchable).toBe(false);
  });

  it('builds reference fields with the nested reference object', () => {
    const f = draftToField({
      ...emptyDraft('reference'),
      label: 'Authors',
      key: 'authors',
      options: { cardinality: 'many', collections: ['author'], min: 1, max: 5 },
    });
    expect(f).toMatchObject({
      format: 'reference',
      reference: { collections: ['author'], min: 1, max: 5 },
    });
    // 'many' is the default and is dropped during normalization.
    expect((f as { reference?: { cardinality?: string } }).reference?.cardinality).toBeUndefined();
  });

  it('omits empty reference config object', () => {
    const f = draftToField({
      ...emptyDraft('reference'),
      label: 'Refs',
      key: 'refs',
      options: { cardinality: 'many', collections: [] },
    });
    expect((f as { reference?: unknown }).reference).toBeUndefined();
  });

  it('builds select with multiple + defaultOptions', () => {
    const f = draftToField({
      ...emptyDraft('select'),
      label: 'Tags',
      key: 'tags',
      options: {
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
        multiple: true,
        defaultOptions: ['a'],
      },
    });
    expect(f).toMatchObject({
      format: 'select',
      multiple: true,
      defaultOptions: ['a'],
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    });
  });

  it('uses defaultOption (singular) when not multiple', () => {
    const f = draftToField({
      ...emptyDraft('select'),
      label: 'Status',
      key: 'status',
      options: {
        options: [{ label: 'Live', value: 'live' }],
        multiple: false,
        defaultOption: 'live',
      },
    });
    expect(f).toMatchObject({ format: 'select', defaultOption: 'live' });
    expect((f as { multiple?: boolean }).multiple).toBeUndefined();
    expect((f as { defaultOptions?: unknown }).defaultOptions).toBeUndefined();
  });

  it('builds conditional with branches', () => {
    const f = draftToField({
      ...emptyDraft('conditional'),
      label: 'Body',
      key: 'body',
      branches: [
        { key: 'a', label: 'A', fields: { x: { label: 'X', format: 'string' } } },
        { key: 'b', label: 'B', collection: 'post' },
      ],
    });
    expect(f).toMatchObject({ format: 'conditional', conditional: { branches: expect.any(Array) } });
    expect((f as unknown as { conditional: { branches: unknown[] } }).conditional.branches).toHaveLength(2);
  });

  it('strips richtext defaults so only explicit overrides land in JSON', () => {
    const f = draftToField({
      ...emptyDraft('richtext'),
      label: 'Body',
      key: 'body',
      richtext: { embeds: {}, toolbar: {} },
    });
    expect((f as { richtext?: unknown }).richtext).toBeUndefined();
  });

  it('persists explicit toolbar:false flags', () => {
    const f = draftToField({
      ...emptyDraft('richtext'),
      label: 'Body',
      key: 'body',
      richtext: { toolbar: { tables: false, codeBlock: false } },
    });
    expect(f).toMatchObject({ richtext: { toolbar: { tables: false, codeBlock: false } } });
  });
});

describe('fieldToDraft <-> draftToField round-trip', () => {
  const cases: { name: string; field: CollectionField }[] = [
    { name: 'string', field: { label: 'Title', format: 'string' } },
    { name: 'string-list', field: { label: 'Tags', format: 'string', list: true } },
    { name: 'text-rows', field: { label: 'Body', format: 'text', rows: 6 } },
    { name: 'markdown', field: { label: 'Body', format: 'markdown' } },
    {
      name: 'number-with-bounds',
      field: { label: 'Score', format: 'number', min: 0, max: 100, valueType: 'int' },
    },
    {
      name: 'select-multi',
      field: {
        label: 'Tags',
        format: 'select',
        multiple: true,
        defaultOptions: ['a'],
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' },
        ],
      },
    },
    {
      name: 'reference-many',
      // 'many' is the default so the round-trip drops it; only the explicit
      // collections list survives.
      field: { label: 'Authors', format: 'reference', reference: { collections: ['author'] } },
    },
    {
      name: 'reference-one',
      field: { label: 'Author', format: 'reference', reference: { cardinality: 'one', collections: ['author'] } },
    },
    { name: 'datetime-dateonly', field: { label: 'Day', format: 'datetime', dateOnly: true } },
    { name: 'slug-with-source', field: { label: 'Slug', format: 'slug', slugSource: 'title' } },
    { name: 'json', field: { label: 'Metadata', format: 'json' } },
    { name: 'url', field: { label: 'Website', format: 'url' } },
    { name: 'color-with-input', field: { label: 'Tint', format: 'color', allowInput: true } },
    { name: 'boolean-default', field: { label: 'Featured', format: 'boolean', defaultBoolean: true } },
    { name: 'image', field: { label: 'Cover', format: 'image' } },
  ];

  for (const { name, field } of cases) {
    it(`preserves ${name}`, () => {
      const draft = fieldToDraft(name, field);
      expect(draftToField(draft)).toEqual(field);
    });
  }
});

describe('reorderFields', () => {
  it('returns fields in the requested order', () => {
    const fields: Record<string, CollectionField> = {
      a: { label: 'A', format: 'string' },
      b: { label: 'B', format: 'string' },
      c: { label: 'C', format: 'string' },
    };
    const reordered = reorderFields(fields, ['c', 'a', 'b']);
    expect(Object.keys(reordered)).toEqual(['c', 'a', 'b']);
  });

  it('drops keys missing from the order argument? No — appends them at the end as a safety net', () => {
    const fields: Record<string, CollectionField> = {
      a: { label: 'A', format: 'string' },
      b: { label: 'B', format: 'string' },
    };
    const reordered = reorderFields(fields, ['b']);
    expect(Object.keys(reordered)).toEqual(['b', 'a']);
  });
});
