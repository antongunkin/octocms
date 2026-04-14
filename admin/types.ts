/**
 * Re-exports all schema / config types from `octocms/types`.
 *
 * Phase 2: Types were promoted to the public layer so that `octocms/defineConfig`
 * and `octocms/query` have zero imports from `octocms/admin/`. All existing
 * imports from `octocms/admin/types` continue to work via this barrel.
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
  NumberCollectionField,
  DatetimeCollectionField,
  JsonCollectionField,
  SlugCollectionField,
  SelectCollectionField,
  ConditionalCollectionField,
  RichTextCollectionField,
} from '../types';
