/**
 * octocms — main entry point
 *
 * Re-exports all public API surface. Admin internals are not included here
 * and are not part of the published package's exports map.
 */
export { createQuery } from './query';
export { defineConfig } from './defineConfig';
export type { CollectionNames, InferEntry, InferFields, InferConditions, FieldFormatToType } from './defineConfig';
export { withOctoCMS } from './withOctoCMS';
export { OCTOCMS_PUBLIC_CONTENT_CACHE_TAG } from './lib/publicContentCacheTag';
export type {
  Config,
  Collection,
  CollectionField,
  EntryStatus,
  FieldFormat,
  ResolvedImageField,
  RichTextDocument,
  RichTextNode,
  ReferenceFieldConfig,
  SelectOption,
  GitIntegrationConfig,
  SearchConfig,
} from './types';
