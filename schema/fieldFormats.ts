/**
 * Registry describing every supported field format.
 *
 * Each entry captures:
 *  - `label` / `description`: shown in the visual editor's "Add field" dialog.
 *  - `optionFields`: per-format option controls (e.g. `min`/`max` for `number`,
 *    `options[]` for `select`, `cardinality` for `reference`).
 *  - `storageNote`: how the value is stored on disk (mirrors `agentDocs.ts`).
 *  - `placeholderValue`: JSON string used in example entries in agent docs.
 *
 * Mirrors the per-format branches in `octocms/types.ts > CollectionField`.
 * When a new format is added, update both this registry and the discriminated
 * union in `octocms/types.ts`.
 */

import type { FieldFormat } from '../types';
import type { FieldFormatMeta } from './types';

export const FIELD_FORMAT_META: Readonly<Record<FieldFormat, FieldFormatMeta>> = {
  string: {
    format: 'string',
    label: 'Short text',
    description: 'Single-line plain text. Set `list: true` to store an array of strings.',
    optionFields: [
      {
        key: 'list',
        label: 'List of strings',
        type: 'boolean',
        description: 'Stores a JSON array of strings; the editor shows a tag-style input.',
        defaultValue: false,
      },
    ],
    storageNote: 'plain text (or JSON array of strings when list: true)',
    placeholderValue: '"Example value"',
  },
  text: {
    format: 'text',
    label: 'Long text',
    description: 'Multi-line plain text rendered as a textarea.',
    optionFields: [
      {
        key: 'rows',
        label: 'Rows',
        type: 'number',
        description: 'Textarea height. Defaults to 4 in the editor.',
      },
    ],
    storageNote: 'plain text',
    placeholderValue: '"Example long text"',
  },
  markdown: {
    format: 'markdown',
    label: 'Markdown',
    description: 'Rich Markdown content. Stored in a companion `.md` file alongside the entry JSON.',
    optionFields: [],
    storageNote: 'companion `.md` file (not in JSON `fields`)',
    placeholderValue: '"(stored in companion .md file — omitted from JSON)"',
  },
  richtext: {
    format: 'richtext',
    label: 'Rich text',
    description:
      'Structured rich text with embeds (references, conditions, images, custom components). Stored in a companion `.mdx` file.',
    optionFields: [
      // The richtext config is complex (embeds, toolbar) and gets its own dedicated
      // sub-editor in Phase 5. The dialog deliberately exposes no scalar options here.
    ],
    storageNote: 'companion `.mdx` file (not in JSON `fields`)',
    placeholderValue: '"(stored in companion .mdx file — omitted from JSON)"',
  },
  boolean: {
    format: 'boolean',
    label: 'Boolean',
    description: 'Yes / No radio buttons. Stored as the string `"true"` or `"false"`.',
    optionFields: [
      { key: 'defaultBoolean', label: 'Default value', type: 'boolean' },
      // Custom labels (booleanLabels) are configured via a follow-up sub-form in the
      // visual editor; they do not fit the simple SchemaOptionField shape.
    ],
    storageNote: '`"true"` or `"false"` (string, not JSON boolean)',
    placeholderValue: '"true"',
  },
  number: {
    format: 'number',
    label: 'Number',
    description: 'Numeric input. Optionally constrained by min, max, step, and integer-vs-float.',
    optionFields: [
      { key: 'min', label: 'Minimum', type: 'number' },
      { key: 'max', label: 'Maximum', type: 'number' },
      { key: 'step', label: 'Step', type: 'number', description: 'Use `any` for free-form decimals.' },
      {
        key: 'valueType',
        label: 'Value type',
        type: 'enum',
        enumValues: ['int', 'float'],
        defaultValue: 'float',
      },
    ],
    storageNote: 'JSON number or `null`',
    placeholderValue: '0',
  },
  datetime: {
    format: 'datetime',
    label: 'Date / time',
    description: 'ISO 8601 timestamp picker. Toggle `dateOnly` for a `YYYY-MM-DD` date picker.',
    optionFields: [
      { key: 'dateOnly', label: 'Date only', type: 'boolean', defaultValue: false },
      {
        key: 'defaultNow',
        label: 'Default to current time',
        type: 'boolean',
        description: 'New entries get the current timestamp at creation.',
        defaultValue: false,
      },
    ],
    storageNote: 'ISO 8601 string (or `YYYY-MM-DD` when `dateOnly`) or `null`',
    placeholderValue: '"2024-01-01T00:00:00.000Z"',
  },
  json: {
    format: 'json',
    label: 'JSON',
    description: 'Free-form JSON value (object, array, or primitive). Validated for syntax in the editor.',
    optionFields: [],
    storageNote: 'any valid JSON value',
    placeholderValue: 'null',
  },
  slug: {
    format: 'slug',
    label: 'Slug',
    description: 'URL-safe segment derived from another field (or from the `entryTitle` field).',
    optionFields: [
      {
        key: 'slugSource',
        label: 'Source field',
        type: 'string',
        description:
          'Field key to derive the slug from. Must be a non-list `string` or `text` field. ' +
          'If omitted, the field marked `entryTitle: true` is used.',
      },
    ],
    storageNote: 'URL-safe string',
    placeholderValue: '"example-slug"',
  },
  url: {
    format: 'url',
    label: 'URL',
    description: 'Absolute (`https://…`) or root-relative (`/…`) URL.',
    optionFields: [],
    storageNote: 'URL string (`http(s)://` or root-relative `/`)',
    placeholderValue: '"https://example.com"',
  },
  color: {
    format: 'color',
    label: 'Colour',
    description: 'Hex colour stored as `#rrggbb`. Optionally show a synced text input.',
    optionFields: [{ key: 'allowInput', label: 'Show hex text input', type: 'boolean', defaultValue: false }],
    storageNote: '`#rrggbb` hex string',
    placeholderValue: '"#000000"',
  },
  select: {
    format: 'select',
    label: 'Select',
    description: 'Pick one or many values from a fixed list of options.',
    optionFields: [
      {
        key: 'options',
        label: 'Options',
        type: 'selectOptions',
        required: true,
        description: 'Each option has a `label` and a unique `value` (the value is stored on disk).',
      },
      {
        key: 'multiple',
        label: 'Allow multiple selections',
        type: 'boolean',
        defaultValue: false,
      },
      {
        key: 'defaultOption',
        label: 'Default value',
        type: 'string',
        description: 'Single-select default. Must match an option `value`.',
      },
      {
        key: 'defaultOptions',
        label: 'Default values',
        type: 'stringList',
        description: 'Multiselect defaults. Each value must match an option `value`.',
      },
    ],
    storageNote: 'option value string (or JSON array when `multiple: true`)',
    placeholderValue: '"option-value"',
  },
  image: {
    format: 'image',
    label: 'Image',
    description: 'Reference to a media library entry. Resolved by `query()` to a typed image object.',
    optionFields: [],
    storageNote: 'media entry UUID string',
    placeholderValue: '"<media-entry-uuid>"',
  },
  reference: {
    format: 'reference',
    label: 'Reference',
    description: 'Link to one or many entries from selected collections. Resolved deeply by `query()`.',
    optionFields: [
      {
        key: 'collections',
        label: 'Allowed collections',
        type: 'collections',
        description: 'When omitted, references can target any collection.',
      },
      {
        key: 'cardinality',
        label: 'Cardinality',
        type: 'enum',
        enumValues: ['one', 'many'],
        defaultValue: 'many',
      },
      {
        key: 'min',
        label: 'Minimum items',
        type: 'number',
        description: 'Only applies when cardinality is `many`.',
      },
      {
        key: 'max',
        label: 'Maximum items',
        type: 'number',
        description: 'Only applies when cardinality is `many`.',
      },
    ],
    storageNote: 'reference key string (e.g. `type-id.json`) or JSON array of keys for cardinality `many`',
    placeholderValue: '"<collection>-<id>.json"',
  },
  conditional: {
    format: 'conditional',
    label: 'Conditional',
    description:
      'Branching field — at query time the entry stores one of several typed shapes ' +
      '(inline fields or a referenced collection). Edited via a dedicated sub-editor.',
    optionFields: [
      // Branch authoring is too rich for the SchemaOptionField shape; the visual
      // editor surfaces a dedicated "Branches" panel in Phase 5.
    ],
    storageNote: 'JSON object (structure varies by branch)',
    placeholderValue: '{}',
  },
};

/**
 * Stable iteration order for UI surfaces (matches the order the formats appear
 * in the discriminated union in `octocms/types.ts`).
 */
export const FIELD_FORMATS: readonly FieldFormat[] = [
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

export function getFieldFormatMeta(format: FieldFormat): FieldFormatMeta {
  return FIELD_FORMAT_META[format];
}
