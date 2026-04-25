/**
 * Pure helpers that bridge the visual editor's "field draft" state and the
 * `CollectionField` discriminated union it serializes to.
 *
 * The Add/Edit Field dialog keeps a small `FieldDraft` in component state
 * (label, key, common flags, format, plus a flat `Record<string, unknown>` of
 * format-specific option values). On save we build a real `CollectionField`
 * from that draft; on edit we extract a draft from an existing field.
 *
 * Keeping this layer pure lets us unit-test the round-trip without spinning
 * up React.
 */

import type {
  CollectionField,
  ConditionalBranchConfig,
  ConditionalFieldConfig,
  FieldFormat,
  RichTextFieldConfig,
  SelectOption,
} from '../../types';

export interface FieldDraft {
  label: string;
  key: string;
  hint: string;
  required: boolean;
  searchable: boolean;
  entryTitle: boolean;
  format: FieldFormat;
  /** Flat per-format option values keyed by `SchemaOptionField.key`. */
  options: Record<string, unknown>;
  /** Conditional sub-editor state. */
  branches: ConditionalBranchConfig[];
  /** Richtext sub-editor state. */
  richtext: RichTextFieldConfig;
}

const DEFAULT_RICHTEXT: RichTextFieldConfig = {
  embeds: {},
  toolbar: {},
};

/** Empty draft for a freshly-picked format. */
export function emptyDraft(format: FieldFormat): FieldDraft {
  return {
    label: '',
    key: '',
    hint: '',
    required: false,
    searchable: true,
    entryTitle: false,
    format,
    options: defaultOptionsForFormat(format),
    branches: [],
    richtext: { ...DEFAULT_RICHTEXT },
  };
}

/** Pull defaultValue from FIELD_FORMAT_META for a fresh draft. */
function defaultOptionsForFormat(format: FieldFormat): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Per-format defaults that aren't covered by FIELD_FORMAT_META.defaultValue.
  if (format === 'select') {
    result.options = [];
    result.multiple = false;
  }
  if (format === 'reference') {
    result.cardinality = 'many';
    result.collections = [];
  }
  return result;
}

/** Read an existing field into a draft. */
export function fieldToDraft(key: string, field: CollectionField): FieldDraft {
  const draft: FieldDraft = {
    label: field.label,
    key,
    hint: field.hint ?? '',
    required: field.required === true,
    searchable: field.searchable !== false,
    entryTitle: field.entryTitle === true,
    format: field.format,
    options: {},
    branches: [],
    richtext: { ...DEFAULT_RICHTEXT },
  };

  switch (field.format) {
    case 'string':
      if (field.list) draft.options.list = true;
      break;
    case 'text':
      if (field.rows != null) draft.options.rows = field.rows;
      break;
    case 'boolean':
      if (field.defaultBoolean !== undefined) draft.options.defaultBoolean = field.defaultBoolean;
      break;
    case 'number':
      if (field.min !== undefined) draft.options.min = field.min;
      if (field.max !== undefined) draft.options.max = field.max;
      if (field.step !== undefined) draft.options.step = field.step;
      if (field.valueType) draft.options.valueType = field.valueType;
      break;
    case 'datetime':
      if (field.dateOnly) draft.options.dateOnly = true;
      if (field.defaultNow) draft.options.defaultNow = true;
      break;
    case 'slug':
      if (field.slugSource) draft.options.slugSource = field.slugSource;
      break;
    case 'color':
      if (field.allowInput) draft.options.allowInput = true;
      break;
    case 'select':
      draft.options.options = [...(field.options ?? [])];
      draft.options.multiple = field.multiple === true;
      if (field.defaultOption !== undefined) draft.options.defaultOption = field.defaultOption;
      if (field.defaultOptions) draft.options.defaultOptions = [...field.defaultOptions];
      break;
    case 'reference':
      draft.options.cardinality = field.reference?.cardinality ?? 'many';
      draft.options.collections = field.reference?.collections ? [...field.reference.collections] : [];
      if (field.reference?.min !== undefined) draft.options.min = field.reference.min;
      if (field.reference?.max !== undefined) draft.options.max = field.reference.max;
      break;
    case 'conditional':
      draft.branches = cloneBranches(field.conditional.branches);
      break;
    case 'richtext':
      draft.richtext = field.richtext ? cloneRichText(field.richtext) : { ...DEFAULT_RICHTEXT };
      break;
    default:
      break;
  }

  return draft;
}

function cloneBranches(branches: readonly ConditionalBranchConfig[]): ConditionalBranchConfig[] {
  return branches.map((b) => {
    if ('collection' in b && typeof b.collection === 'string') {
      return { key: b.key, label: b.label, collection: b.collection } as ConditionalBranchConfig;
    }
    return {
      key: b.key,
      label: b.label,
      fields: { ...(b.fields ?? {}) },
    } as ConditionalBranchConfig;
  });
}

function cloneRichText(rt: RichTextFieldConfig): RichTextFieldConfig {
  return {
    embeds: rt.embeds
      ? {
          ...rt.embeds,
          references: rt.embeds.references ? { ...rt.embeds.references } : undefined,
          variables: rt.embeds.variables ? [...rt.embeds.variables] : undefined,
          components: rt.embeds.components ? { ...rt.embeds.components } : undefined,
        }
      : {},
    toolbar: rt.toolbar ? { ...rt.toolbar } : {},
  };
}

/** Serialize a draft back into a `CollectionField` (typed via discriminated union). */
export function draftToField(draft: FieldDraft): CollectionField {
  // Build the common base. We assemble plain objects and trust validateConfig
  // to enforce per-format invariants (the draft UI prevents most violations).
  const common: Record<string, unknown> = {
    label: draft.label.trim(),
  };
  if (draft.hint.trim()) common.hint = draft.hint.trim();
  if (draft.required) common.required = true;
  if (draft.searchable === false) common.searchable = false;
  if (draft.entryTitle) common.entryTitle = true;

  const opts = draft.options;
  switch (draft.format) {
    case 'string': {
      const f: Record<string, unknown> = { ...common, format: 'string' };
      if (opts.list) f.list = true;
      return f as CollectionField;
    }
    case 'text': {
      const f: Record<string, unknown> = { ...common, format: 'text' };
      if (typeof opts.rows === 'number' && opts.rows > 0) f.rows = opts.rows;
      return f as CollectionField;
    }
    case 'markdown':
      return { ...common, format: 'markdown' } as CollectionField;
    case 'boolean': {
      const f: Record<string, unknown> = { ...common, format: 'boolean' };
      if (opts.defaultBoolean !== undefined) f.defaultBoolean = opts.defaultBoolean === true;
      return f as CollectionField;
    }
    case 'number': {
      const f: Record<string, unknown> = { ...common, format: 'number' };
      if (typeof opts.min === 'number') f.min = opts.min;
      if (typeof opts.max === 'number') f.max = opts.max;
      if (typeof opts.step === 'number') f.step = opts.step;
      if (opts.valueType === 'int' || opts.valueType === 'float') f.valueType = opts.valueType;
      return f as CollectionField;
    }
    case 'datetime': {
      const f: Record<string, unknown> = { ...common, format: 'datetime' };
      if (opts.dateOnly) f.dateOnly = true;
      if (opts.defaultNow) f.defaultNow = true;
      return f as CollectionField;
    }
    case 'json':
      return { ...common, format: 'json' } as CollectionField;
    case 'slug': {
      const f: Record<string, unknown> = { ...common, format: 'slug' };
      if (typeof opts.slugSource === 'string' && opts.slugSource.trim().length > 0) {
        f.slugSource = opts.slugSource.trim();
      }
      return f as CollectionField;
    }
    case 'url':
      return { ...common, format: 'url' } as CollectionField;
    case 'color': {
      const f: Record<string, unknown> = { ...common, format: 'color' };
      if (opts.allowInput) f.allowInput = true;
      return f as CollectionField;
    }
    case 'image':
      return { ...common, format: 'image' } as CollectionField;
    case 'select': {
      const options = Array.isArray(opts.options) ? (opts.options as SelectOption[]) : [];
      const multiple = opts.multiple === true;
      const f: Record<string, unknown> = {
        ...common,
        format: 'select',
        options,
      };
      if (multiple) {
        f.multiple = true;
        if (Array.isArray(opts.defaultOptions) && opts.defaultOptions.length > 0) {
          f.defaultOptions = [...(opts.defaultOptions as string[])];
        }
      } else if (typeof opts.defaultOption === 'string' && opts.defaultOption.length > 0) {
        f.defaultOption = opts.defaultOption;
      }
      return f as CollectionField;
    }
    case 'reference': {
      const ref: Record<string, unknown> = {};
      if (Array.isArray(opts.collections) && opts.collections.length > 0) {
        ref.collections = [...(opts.collections as string[])];
      }
      // Only persist cardinality when it's not the implicit default ('many').
      if (opts.cardinality === 'one') ref.cardinality = 'one';
      if (typeof opts.min === 'number') ref.min = opts.min;
      if (typeof opts.max === 'number') ref.max = opts.max;
      const f: Record<string, unknown> = { ...common, format: 'reference' };
      if (Object.keys(ref).length > 0) f.reference = ref;
      return f as CollectionField;
    }
    case 'conditional': {
      const conditional: ConditionalFieldConfig = {
        branches: cloneBranches(draft.branches),
      };
      return { ...common, format: 'conditional', conditional } as CollectionField;
    }
    case 'richtext': {
      const f: Record<string, unknown> = { ...common, format: 'richtext' };
      const cleaned = pruneEmptyRichText(draft.richtext);
      if (cleaned) f.richtext = cleaned;
      return f as CollectionField;
    }
    default:
      throw new Error(`Unknown field format: ${(draft as { format: string }).format}`);
  }
}

function pruneEmptyRichText(rt: RichTextFieldConfig): RichTextFieldConfig | null {
  const embeds: NonNullable<RichTextFieldConfig['embeds']> = {};
  if (rt.embeds?.references && (rt.embeds.references.collections?.length || rt.embeds.references.display)) {
    embeds.references = { ...rt.embeds.references };
  }
  if (rt.embeds?.conditions === true) embeds.conditions = true;
  if (rt.embeds?.images === true) embeds.images = true;
  if (rt.embeds?.variables && rt.embeds.variables.length > 0) embeds.variables = [...rt.embeds.variables];
  if (rt.embeds?.components && Object.keys(rt.embeds.components).length > 0) {
    embeds.components = { ...rt.embeds.components };
  }

  const toolbar: NonNullable<RichTextFieldConfig['toolbar']> = {};
  for (const [k, v] of Object.entries(rt.toolbar ?? {})) {
    // Only persist explicit `false` (toolbar opts default to true); persisting
    // `true` is noise.
    if (v === false) (toolbar as Record<string, boolean>)[k] = false;
  }

  const out: RichTextFieldConfig = {};
  if (Object.keys(embeds).length > 0) out.embeds = embeds;
  if (Object.keys(toolbar).length > 0) out.toolbar = toolbar;
  return Object.keys(out).length > 0 ? out : null;
}

/** Reorder a Record<string, CollectionField> to match `nextOrder`. */
export function reorderFields(
  fields: Record<string, CollectionField>,
  nextOrder: readonly string[],
): Record<string, CollectionField> {
  const result: Record<string, CollectionField> = {};
  for (const k of nextOrder) {
    if (k in fields) result[k] = fields[k]!;
  }
  // Append any keys that are missing from nextOrder (safety net — shouldn't
  // happen during normal use, but prevents data loss if state drifts).
  for (const k of Object.keys(fields)) {
    if (!(k in result)) result[k] = fields[k]!;
  }
  return result;
}
