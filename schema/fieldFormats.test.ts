import { describe, expect, it } from 'vitest';

import { validateConfig } from '../cli/lib/validateConfig';
import type { CollectionField, Config, FieldFormat } from '../types';
import { FIELD_FORMATS, FIELD_FORMAT_META, getFieldFormatMeta } from './fieldFormats';

const ALL_FORMATS: FieldFormat[] = [
  'string',
  'text',
  'markdown',
  'boolean',
  'reference',
  'image',
  'number',
  'datetime',
  'json',
  'slug',
  'select',
  'url',
  'color',
  'conditional',
  'richtext',
];

describe('FIELD_FORMATS registry', () => {
  it('exposes meta for all 15 formats', () => {
    for (const format of ALL_FORMATS) {
      expect(FIELD_FORMAT_META[format]).toBeDefined();
      expect(FIELD_FORMAT_META[format].format).toBe(format);
    }
    expect(Object.keys(FIELD_FORMAT_META).length).toBe(ALL_FORMATS.length);
  });

  it('FIELD_FORMATS array contains every format key exactly once', () => {
    const set = new Set(FIELD_FORMATS);
    expect(set.size).toBe(FIELD_FORMATS.length);
    for (const format of ALL_FORMATS) expect(set.has(format)).toBe(true);
  });

  it('every meta entry has non-empty label, description, storageNote, placeholderValue', () => {
    for (const format of ALL_FORMATS) {
      const meta = FIELD_FORMAT_META[format];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
      expect(meta.storageNote.length).toBeGreaterThan(0);
      expect(meta.placeholderValue.length).toBeGreaterThan(0);
    }
  });

  it('every option field has a unique key inside its format', () => {
    for (const format of ALL_FORMATS) {
      const keys = FIELD_FORMAT_META[format].optionFields.map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  it('select declares an `options` field that is required', () => {
    const optionsField = FIELD_FORMAT_META.select.optionFields.find((f) => f.key === 'options');
    expect(optionsField).toBeDefined();
    expect(optionsField?.required).toBe(true);
  });

  it('reference declares cardinality enum with one|many', () => {
    const cardinality = FIELD_FORMAT_META.reference.optionFields.find((f) => f.key === 'cardinality');
    expect(cardinality?.type).toBe('enum');
    expect(cardinality?.enumValues).toEqual(['one', 'many']);
  });

  it('getFieldFormatMeta returns the same object as the map', () => {
    expect(getFieldFormatMeta('string')).toBe(FIELD_FORMAT_META.string);
  });
});

/**
 * For each format, build a `CollectionField` that exercises every option in the
 * registry, then run `validateConfig` to confirm the registered options round-trip
 * cleanly through the validator. This catches drift between `FIELD_FORMAT_META`
 * and the `CollectionField` discriminated union / validator branches.
 */
const FIELD_BY_FORMAT: Record<FieldFormat, CollectionField> = {
  string: { label: 'S', format: 'string', list: true },
  text: { label: 'T', format: 'text', rows: 6 },
  markdown: { label: 'M', format: 'markdown' },
  richtext: { label: 'R', format: 'richtext' },
  boolean: { label: 'B', format: 'boolean', defaultBoolean: true },
  number: { label: 'N', format: 'number', min: 0, max: 10, step: 1, valueType: 'int' },
  datetime: { label: 'D', format: 'datetime', dateOnly: true, defaultNow: true },
  json: { label: 'J', format: 'json' },
  slug: { label: 'Sl', format: 'slug', slugSource: 'title' },
  url: { label: 'U', format: 'url' },
  color: { label: 'C', format: 'color', allowInput: true },
  image: { label: 'I', format: 'image' },
  select: {
    label: 'Se',
    format: 'select',
    options: [
      { label: 'A', value: 'a' },
      { label: 'B', value: 'b' },
    ],
    multiple: true,
    defaultOptions: ['a'],
  },
  reference: {
    label: 'Ref',
    format: 'reference',
    reference: { collections: ['author'], cardinality: 'many', min: 1, max: 5 },
  },
  conditional: {
    label: 'Cond',
    format: 'conditional',
    conditional: {
      branches: [{ key: 'inline', label: 'Inline', fields: { x: { label: 'X', format: 'string' } } }],
    },
  },
};

function configWithField(format: FieldFormat): Config {
  return {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', entryTitle: true },
          target: FIELD_BY_FORMAT[format],
        },
      },
      author: {
        label: 'Author',
        hasMany: true,
        fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
      },
    },
  };
}

describe('FIELD_FORMAT_META option-schema round-trip', () => {
  for (const format of FIELD_FORMATS) {
    it(`${format}: example field validates`, () => {
      const cfg = configWithField(format);
      expect(() => validateConfig(cfg, ['post', 'author'])).not.toThrow();
    });
  }
});
