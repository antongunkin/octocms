/**
 * Public-layer schema authoring types — used by the visual Content Model
 * editor and the upcoming `octocms/admin/actions/schema.ts` server actions.
 *
 * No imports from `octocms/admin/`. Lives alongside the existing public
 * surface (`octocms/types`, `octocms/defineConfig`, `octocms/query`).
 */

export type {
  FieldFormat,
  ReferenceFieldConfig,
  SelectOption,
  ConditionalBranchConfig,
  ConditionalFieldConfig,
  RichTextComponentProp,
  RichTextComponentDef,
  RichTextToolbarConfig,
  RichTextFieldConfig,
  CollectionField,
  Collection,
  GitIntegrationConfig,
  PublicCollectionSearchConfig,
  SearchConfig,
  Config,
} from '../types';

import type { FieldFormat } from '../types';

/**
 * Type marker for a single configurable option on a field format. The visual
 * editor renders one form control per `SchemaOptionField` when configuring a
 * field of a given format.
 */
export type SchemaOptionFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  /** Multi-select of collection keys (e.g. `reference.collections`). */
  | 'collections'
  /** Editable list of `{ label, value }` pairs (for `select.options`). */
  | 'selectOptions'
  /** Free-form key/label list (for richtext variables, conditional branches). */
  | 'stringList';

export interface SchemaOptionField {
  /** Property name on the `CollectionField` (e.g. `min`, `max`, `multiple`). */
  key: string;
  label: string;
  type: SchemaOptionFieldType;
  /** Allowed values when `type === 'enum'`. */
  enumValues?: readonly string[];
  /** Optional helper text shown under the control. */
  description?: string;
  /** When true, the editor blocks save until a value is provided. */
  required?: boolean;
  /** Initial value when adding a new field of this format. */
  defaultValue?: unknown;
}

/**
 * Single source of truth for a field format's metadata: human-readable label,
 * description, configurable options, storage description, and JSON placeholder
 * for example entries. Drives the visual editor's "Add field" dialog and the
 * agent docs (replacing hand-coded switches in `FormFields.tsx`,
 * `validateConfig.ts`, `agentDocs.ts`).
 */
export interface FieldFormatMeta {
  format: FieldFormat;
  label: string;
  description: string;
  optionFields: readonly SchemaOptionField[];
  /** One-line description of how the value is stored on disk. */
  storageNote: string;
  /** JSON-string placeholder for example entries in agent docs. */
  placeholderValue: string;
}
