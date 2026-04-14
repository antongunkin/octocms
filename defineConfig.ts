import type { Config, ResolvedImageField, RichTextDocument } from "./types";

/**
 * Define the CMS configuration with full literal type inference.
 *
 * Wrapping your config in `defineConfig()` preserves exact collection names,
 * field names, and field formats as literal types — enabling type-safe queries
 * with autocomplete in `cms/query.ts`.
 *
 * Use `as const` on `select` field `options` (and `defaultOptions`) so option
 * `value`s infer as string literal unions in `InferFields`.
 *
 * @example
 * ```ts
 * // cms/octocms.config.ts
 * import { defineConfig } from 'octocms/defineConfig';
 *
 * export const config = defineConfig({
 *   projectName: 'My Site',
 *   git: { baseBranch: 'main', publishedPointerBranch: 'cms/publish-pointer' },
 *   collections: { post: { label: 'Post', hasMany: true, fields: { ... } } },
 *   // ...
 * });
 * ```
 */
export function defineConfig<T extends Config>(config: T): T {
  return config;
}

// ---------------------------------------------------------------------------
// Type utilities — infer entry shapes from a defineConfig() config literal
// ---------------------------------------------------------------------------

/** Map a field `format` string to the runtime TypeScript type it produces after processing. */
export type FieldFormatToType = {
  string: string;
  text: string;
  markdown: string;
  richtext: RichTextDocument;
  boolean: "true" | "false";
  number: number | null;
  datetime: string | null;
  image: ResolvedImageField;
  reference: unknown;
  json: unknown;
  slug: string;
  select: string;
  url: string;
  color: string;
  conditional: unknown;
};

/** Union of option `value` literals when `options` is a readonly tuple. */
type OptionValues<Opts> =
  Opts extends ReadonlyArray<{ readonly value: infer V }>
    ? V extends string
      ? V
      : string
    : string;

/** Extract the collection names defined in a config object. */
export type CollectionNames<C extends Config> = Extract<
  keyof C["collections"],
  string
>;

// ---------------------------------------------------------------------------
// Conditional field type inference
// ---------------------------------------------------------------------------

/** Infer the resolved value type for a single field definition. */
type InferSingleFieldType<F> = F extends { format: "string"; list: true }
  ? string[]
  : F extends { format: "boolean" }
    ? "true" | "false"
    : F extends { format: "select"; multiple: true; options: infer Opts }
      ? OptionValues<Opts>[]
      : F extends { format: "select"; options: infer Opts }
        ? OptionValues<Opts>
        : F extends {
              format: "conditional";
              conditional: { branches: infer B };
            }
          ? InferConditionalValue<B>
          : F extends { format: infer Fmt }
            ? Fmt extends keyof FieldFormatToType
              ? FieldFormatToType[Fmt]
              : unknown
            : unknown;

/** Infer the inline fields type for a branch's fields record. */
type InferBranchInlineFields<Fields> = {
  [K in Extract<keyof Fields, string>]: InferSingleFieldType<Fields[K]>;
};

/**
 * Infer the value type for a single branch.
 * - Inline branch (`fields`): produces an object type mapping field names to their inferred types.
 * - Reference branch (`collection`): produces `unknown` (resolved at runtime to the referenced entry).
 */
type InferBranchValue<B> = B extends { fields: infer F }
  ? InferBranchInlineFields<F>
  : unknown;

/**
 * Infer the union of all branch value types for a conditional field.
 * This is the type the consumer gets after selecting a branch at query time.
 */
type InferConditionalValue<Branches> = Branches extends readonly [
  infer Head,
  ...infer Tail,
]
  ? InferBranchValue<Head> | InferConditionalValue<Tail>
  : never;

/**
 * Extract the literal union of branch `key` strings from a conditional field's branches tuple.
 * Requires `as const` on the branches array in `cms/octocms.config.ts` for literal inference.
 */
export type InferConditionalKeys<Branches> = Branches extends readonly [
  infer Head,
  ...infer Tail,
]
  ?
      | (Head extends { key: infer K } ? (K extends string ? K : never) : never)
      | InferConditionalKeys<Tail>
  : never;

// ---------------------------------------------------------------------------
// InferFields / InferEntry
// ---------------------------------------------------------------------------

/** Infer the `fields` shape for a collection, mapping each field format to its TS type. */
export type InferFields<
  C extends Config,
  Name extends CollectionNames<C>,
> = C["collections"][Name] extends {
  fields: infer F;
}
  ? {
      [K in Extract<keyof F, string>]: InferSingleFieldType<F[K]>;
    }
  : Record<string, unknown>;

/** A fully-typed content entry for a given collection. */
export type InferEntry<C extends Config, Name extends CollectionNames<C>> = {
  sys: { id: string; type: Name };
  fields: InferFields<C, Name>;
};

// ---------------------------------------------------------------------------
// InferConditions — extract the required `conditions` record for `query()`
// ---------------------------------------------------------------------------

/**
 * For a single collection, build `Record<fieldName, branchKeyUnion>` for every `format: 'conditional'` field.
 * If the collection has no conditional fields this resolves to `{}` (empty object / `never` keys).
 */
export type InferConditions<
  C extends Config,
  Name extends CollectionNames<C>,
> = C["collections"][Name] extends {
  fields: infer F;
}
  ? {
      [K in Extract<keyof F, string> as F[K] extends { format: "conditional" }
        ? K
        : never]: F[K] extends {
        conditional: { branches: infer B };
      }
        ? InferConditionalKeys<B>
        : never;
    }
  : {};
