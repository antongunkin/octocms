export type EntryStatus = 'draft' | 'published' | 'changed' | 'archived' | 'merged';

// ---------------------------------------------------------------------------
// Schema / config types (previously in octocms/admin/types)
// COLLECTIONS constraint widened to `string` so this layer has no admin deps.
// ---------------------------------------------------------------------------

export type FieldFormat =
  | 'string'
  | 'text'
  | 'markdown'
  | 'boolean'
  | 'reference'
  | 'image'
  | 'number'
  | 'datetime'
  | 'json'
  | 'slug'
  | 'select'
  | 'url'
  | 'color'
  | 'conditional'
  | 'richtext';

export type ReferenceFieldConfig = {
  /** Which collections this reference can point to. Defaults to all collections. */
  collections?: string[];
  /** 'one' = single reference, 'many' = array of references. Defaults to 'many'. */
  cardinality?: 'one' | 'many';
  /** Minimum number of references (for 'many'). */
  min?: number;
  /** Maximum number of references (for 'many'). */
  max?: number;
};

/** Shared keys on every collection field definition. */
type CollectionFieldBase = {
  label: string;
  entryTitle?: boolean;
  /** When true, the field must be non-empty; save is blocked until valid. */
  required?: boolean;
  /** Optional helper text shown below the field in the admin UI. */
  hint?: string;
  /** Include in search index. Defaults to true for text-like formats (string, text, markdown, richtext, slug, select). Set false to exclude. */
  searchable?: boolean;
};

export type SelectOption = { label: string; value: string };

/** A branch in a conditional field — either inline fields or a reference to a collection. */
export type ConditionalBranchConfig =
  | {
      /** Unique key identifying this branch (used at query time to select it). */
      key: string;
      label: string;
      /** Inline field definitions for this branch. */
      fields: Record<string, CollectionField>;
      collection?: never;
    }
  | {
      /** Unique key identifying this branch (used at query time to select it). */
      key: string;
      label: string;
      /** Reference branch — reuses an existing collection's schema. */
      collection: string;
      fields?: never;
    };

export type ConditionalFieldConfig = {
  branches: readonly ConditionalBranchConfig[];
};

/** Prop definition for a custom component in a richtext field. */
export type RichTextComponentProp = {
  name: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'url' | 'image' | 'select';
  options?: readonly SelectOption[];
  required?: boolean;
  defaultValue?: string | number | boolean;
};

/** A custom component that can be embedded in a richtext field. */
export type RichTextComponentDef = {
  label: string;
  /** Inline = sits within a paragraph. Block = occupies its own line. */
  kind: 'inline' | 'block';
  props: RichTextComponentProp[];
};

/** Controls which standard toolbar buttons appear in the richtext editor. All default to `true`. */
export type RichTextToolbarConfig = {
  /** Bold / italic / underline toggles. */
  formatting?: boolean;
  /** Heading / paragraph block type selector. */
  headings?: boolean;
  /** Ordered / unordered list toggles. */
  lists?: boolean;
  /** Inline code toggle. */
  code?: boolean;
  /** Code block insertion. */
  codeBlock?: boolean;
  /** Link creation button. */
  links?: boolean;
  /** Table insertion button. */
  tables?: boolean;
  /** Horizontal rule insertion. */
  thematicBreak?: boolean;
  /** Standard markdown image insertion (URL-based). */
  images?: boolean;
  /** Undo / redo buttons. */
  undoRedo?: boolean;
};

/** Configuration for the richtext field type's embeddable content. */
export type RichTextFieldConfig = {
  embeds?: {
    /** Allow embedding references to other entries. */
    references?: {
      collections?: string[];
      /** Whether references can appear inline, as blocks, or both. Default: 'both'. */
      display?: 'inline' | 'block' | 'both';
    };
    /** Allow embedding conditional (A/B) content branches. */
    conditions?: boolean;
    /** Allow embedding images from the media library. */
    images?: boolean;
    /** Allowed template variable names (e.g. ['user.firstName', 'site.name']). */
    variables?: string[];
    /** Custom components that can be embedded in the editor. */
    components?: Record<string, RichTextComponentDef>;
  };
  /** Customize which standard toolbar buttons are shown. Omitted keys default to `true`. */
  toolbar?: RichTextToolbarConfig;
};

/**
 * Per-format field definitions (discriminated union on `format`).
 * Use `as const` on `options` (and default arrays) in cms/octocms.config.ts for literal type inference in `InferFields`.
 */
export type CollectionField =
  | (CollectionFieldBase & {
      format: 'string';
      /**
       * When `true`, the field stores a JSON array of strings (`string[]`) and the editor shows a tag-style list.
       */
      list?: true;
    })
  | (CollectionFieldBase & {
      format: 'text';
      /** Textarea height; defaults to 4 in the editor. */
      rows?: number;
    })
  | (CollectionFieldBase & { format: 'markdown' })
  | (CollectionFieldBase & {
      format: 'boolean';
      /** When set, new entries get `"true"` or `"false"` in JSON. */
      defaultBoolean?: boolean;
      /** Radio labels in the editor (default Yes / No). */
      booleanLabels?: { true: string; false: string };
    })
  | (CollectionFieldBase & {
      format: 'reference';
      /** @deprecated Use `reference` config instead. Kept for backward compatibility. */
      collection?: string;
      reference?: ReferenceFieldConfig;
    })
  | (CollectionFieldBase & { format: 'image' })
  | (CollectionFieldBase & {
      format: 'number';
      min?: number;
      max?: number;
      step?: number | 'any';
      valueType?: 'int' | 'float';
    })
  | (CollectionFieldBase & {
      format: 'datetime';
      dateOnly?: boolean;
      defaultNow?: boolean;
    })
  | (CollectionFieldBase & { format: 'json' })
  | (CollectionFieldBase & {
      format: 'slug';
      /**
       * Field key to auto-generate from (must be a non-list `string` or `text` field).
       * If omitted, the field marked `entryTitle: true` is used.
       */
      slugSource?: string;
    })
  | (CollectionFieldBase & { format: 'url' })
  | (CollectionFieldBase & {
      format: 'color';
      /** When true, show a hex text field synced with the native color picker. */
      allowInput?: boolean;
    })
  | (CollectionFieldBase & {
      format: 'select';
      options: readonly SelectOption[];
      multiple?: boolean;
      /** Default for new entries when `multiple` is not true; must match an option `value`. */
      defaultOption?: string;
      /** Default for new entries when `multiple: true`; each entry must match an option `value`. */
      defaultOptions?: readonly string[];
    })
  | (CollectionFieldBase & {
      format: 'conditional';
      conditional: ConditionalFieldConfig;
    })
  | (CollectionFieldBase & {
      format: 'richtext';
      richtext?: RichTextFieldConfig;
    });

export type Collection = {
  label: string;
  hasMany?: boolean;
  fields: Record<string, CollectionField>;
};

/** Git / GitHub integration — branch names live in config (not environment variables). */
export type GitIntegrationConfig = {
  /** Default branch; feature branches are created from here and PRs target this ref. */
  baseBranch: string;
  /**
   * Branch that holds `cms/published.json` so Publish avoids committing to a protected base branch.
   * When omitted, the pointer file is read and written on `baseBranch`.
   */
  publishedPointerBranch?: string;
};

export type PublicCollectionSearchConfig = {
  /** URL pattern with `:fieldName` placeholders resolved from entry fields.
   *  Examples: '/blog/:slug', '/items/:id', '/' (fixed path for singletons) */
  urlPattern: string;
};

export type SearchConfig = {
  /** Collections searchable on the public site + their URL mapping.
   *  Omit or set to empty object = public search disabled. */
  publicCollections?: Record<string, PublicCollectionSearchConfig>;
};

export type Config = {
  projectName: string;
  contentFolder: string;
  mediaFolder: string;
  mediaAllowedFormats: string[];
  git: GitIntegrationConfig;
  collections: Record<string, Collection>;
  /** Full-text search configuration. */
  search?: SearchConfig;
};

/** Narrowed field types for parsers that only apply to one format. */
export type NumberCollectionField = Extract<CollectionField, { format: 'number' }>;
export type DatetimeCollectionField = Extract<CollectionField, { format: 'datetime' }>;
export type JsonCollectionField = Extract<CollectionField, { format: 'json' }>;
export type SlugCollectionField = Extract<CollectionField, { format: 'slug' }>;
export type SelectCollectionField = Extract<CollectionField, { format: 'select' }>;
export type ConditionalCollectionField = Extract<CollectionField, { format: 'conditional' }>;
export type RichTextCollectionField = Extract<CollectionField, { format: 'richtext' }>;

export type SelectedFile = {
  type: string;
  id: string;
  path: string;
};

export type EntryListItem = {
  type: string;
  /** Filename stem (last path segment without `.json`), e.g. `post-123` for `post/post-123.json`. */
  id: string;
  /** Full repo-relative JSON path, e.g. `cms/content/post/post-123.json`. Use with `toReferenceKey(path)` for storage keys. */
  path: string;
  title: string;
  status: EntryStatus;
  /** ISO 8601 last-modified timestamp. Populated from fs.stat in dev mode; undefined in production. */
  updatedAt?: string;
};

/** A reference item stored in a reference field value. */
export type ReferenceItem = {
  /** The collection type (e.g. 'post', 'author'). */
  type: string;
  /** The entry ID (UUID or fixed ID). */
  id: string;
  /** Normalized reference key (e.g. 'post-abc.json'). */
  path: string;
  /** Display title extracted from the entry's entryTitle field. */
  title: string;
};

export type FileContextValues = {
  selectedType: string | undefined;
  selectedFile: SelectedFile | undefined;
  onTypeClick: (type: string | undefined) => void;
  onFileClick: (file: SelectedFile | undefined) => void;
};

/** Shape of `format: 'image'` fields after `query()` / `processEntry` resolution. */
export type ResolvedImageField = {
  src: string;
  alt: string;
  width: number | null;
  height: number | null;
  blurDataURL: string | null;
};

// ---------------------------------------------------------------------------
// Rich Text AST — returned by `query()` for `format: 'richtext'` fields
// ---------------------------------------------------------------------------

export type RichTextNode =
  | { type: 'paragraph'; children: RichTextNode[] }
  | { type: 'blockquote'; children: RichTextNode[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: RichTextNode[] }
  | {
      type: 'text';
      value: string;
      marks?: ('bold' | 'italic' | 'underline' | 'code')[];
    }
  | { type: 'link'; url: string; children: RichTextNode[] }
  | { type: 'image'; image: ResolvedImageField }
  | { type: 'reference'; entry: unknown; display: 'inline' | 'block' }
  | {
      type: 'condition';
      field: string;
      branches: Record<string, RichTextDocument> | RichTextDocument;
    }
  | { type: 'variable'; name: string }
  | {
      type: 'component';
      name: string;
      props: Record<string, unknown>;
      children?: RichTextNode[];
    }
  | { type: 'list'; ordered: boolean; children: RichTextNode[] }
  | { type: 'listItem'; children: RichTextNode[] }
  | { type: 'thematicBreak' }
  | { type: 'code'; lang?: string; value: string }
  | { type: 'html'; value: string }
  | { type: 'break' };

export type RichTextDocument = { type: 'doc'; content: RichTextNode[] };

export type MediaFile = {
  id: string;
  /** Required for new uploads; used as default alt text when the image is referenced. */
  title: string;
  originalName: string;
  path: string;
  folder: string;
  publicUrl: string;
  extension: string;
  width: number | null;
  height: number | null;
  /** True when the entry stores a blur placeholder (data URL omitted from list payloads). */
  hasBlurPlaceholder: boolean;
};
