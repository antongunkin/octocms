/**
 * CMS config validation — validates the schema configuration object.
 *
 * Shared between the CLI (`octocms types:gen`, `octocms validate`) and the
 * codegen scripts (`scripts/generate-types.ts`, `scripts/generate-docs.ts`).
 *
 * Moved here from `scripts/lib/validate-config.ts` as part of Phase 4 (CLI).
 */

import type { CollectionField, ConditionalBranchConfig, Config } from '../../types';

// TS identifier: starts with letter/$/_,  followed by word chars
const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/**
 * Validate a CMS config object. Throws on the first invalid rule.
 *
 * Shared between `generate-docs.ts` and `generate-types.ts` so every
 * codegen script applies the same checks before emitting output.
 */
export function validateConfig(config: Config, collectionNames: readonly string[]): void {
  validateAdminCache(config);

  for (const key of collectionNames) {
    const col = config.collections[key as keyof typeof config.collections];
    if (!col) {
      throw new Error(`validate — collection "${key}" is listed but not defined in config.collections`);
    }

    const fieldEntries = Object.entries(col.fields);

    if (fieldEntries.length === 0) {
      throw new Error(`validate — collection "${key}" must have at least one field`);
    }

    for (const [fieldName, field] of fieldEntries) {
      if (!VALID_IDENTIFIER.test(fieldName)) {
        throw new Error(`validate — collection "${key}" field "${fieldName}" is not a valid TypeScript identifier`);
      }

      validateField(collectionNames, key, fieldName, field, col.fields);
    }
  }
}

function validateAdminCache(config: Config): void {
  const cache = config.admin?.cache;
  if (!cache) return;

  if (cache.enabled !== undefined && typeof cache.enabled !== 'boolean') {
    throw new Error('validate — admin.cache.enabled must be a boolean');
  }

  const branchRevalidateSeconds = cache.branchRevalidateSeconds ?? 30;
  const staleIfErrorSeconds = cache.staleIfErrorSeconds ?? 86_400;

  if (!Number.isInteger(branchRevalidateSeconds) || branchRevalidateSeconds <= 0) {
    throw new Error('validate — admin.cache.branchRevalidateSeconds must be a positive integer');
  }
  if (!Number.isInteger(staleIfErrorSeconds) || staleIfErrorSeconds <= 0) {
    throw new Error('validate — admin.cache.staleIfErrorSeconds must be a positive integer');
  }
  if (staleIfErrorSeconds < branchRevalidateSeconds) {
    throw new Error(
      'validate — admin.cache.staleIfErrorSeconds must be greater than or equal to branchRevalidateSeconds',
    );
  }
}

function validateField(
  collectionNames: readonly string[],
  collectionKey: string,
  fieldName: string,
  field: CollectionField,
  allFields: Record<string, CollectionField>,
): void {
  const ctx = `collection "${collectionKey}" field "${fieldName}"`;

  // list: true only on format: 'string'
  if (field.format !== 'string' && 'list' in field && (field as { list?: boolean }).list === true) {
    throw new Error(`validate — ${ctx} has list: true but format is not "string"`);
  }

  // slug validation
  if (field.format === 'slug') {
    const source = field.slugSource;
    if (source) {
      const src = allFields[source];
      const ok = src && ((src.format === 'string' && src.list !== true) || src.format === 'text');
      if (!ok) {
        throw new Error(`validate — ${ctx} slugSource must name a non-list string or text field`);
      }
    } else {
      const entryTitleCount = Object.values(allFields).filter((f) => f.entryTitle).length;
      if (entryTitleCount !== 1) {
        throw new Error(`validate — ${ctx} needs slugSource or exactly one entryTitle field`);
      }
    }
  }

  // select validation
  if (field.format === 'select') {
    if (!field.options?.length) {
      throw new Error(`validate — ${ctx} select field needs at least one option`);
    }
    const values = field.options.map((o) => o.value);
    const uniq = new Set(values);
    if (uniq.size !== values.length) {
      throw new Error(`validate — ${ctx} select options must have unique values`);
    }
    if (field.multiple === true) {
      if (field.defaultOption != null) {
        throw new Error(`validate — ${ctx} use defaultOptions with multiple, not defaultOption`);
      }
      if (field.defaultOptions) {
        for (const v of field.defaultOptions) {
          if (!uniq.has(v)) {
            throw new Error(`validate — ${ctx} defaultOptions value "${v}" is not an option`);
          }
        }
      }
    } else {
      if (field.defaultOptions != null && field.defaultOptions.length > 0) {
        throw new Error(`validate — ${ctx} use defaultOption for single select, not defaultOptions`);
      }
      if (field.defaultOption != null && !uniq.has(field.defaultOption)) {
        throw new Error(`validate — ${ctx} defaultOption is not among options`);
      }
    }
  }

  // reference validation
  if (field.format === 'reference') {
    const refCols = field.reference?.collections;
    if (refCols) {
      for (const rc of refCols) {
        if (!collectionNames.includes(rc)) {
          throw new Error(`validate — ${ctx} reference.collections includes unknown collection "${rc}"`);
        }
      }
    }
    if (
      field.reference?.cardinality != null &&
      field.reference.cardinality !== 'one' &&
      field.reference.cardinality !== 'many'
    ) {
      throw new Error(`validate — ${ctx} reference.cardinality must be "one" or "many"`);
    }
    // Legacy `collection` prop
    if (field.collection != null && !collectionNames.includes(field.collection)) {
      throw new Error(`validate — ${ctx} legacy collection prop references unknown collection "${field.collection}"`);
    }
  }

  // conditional validation
  if (field.format === 'conditional') {
    if (!field.conditional?.branches?.length) {
      throw new Error(`validate — ${ctx} conditional field must have at least one branch`);
    }
    const branchKeys = new Set<string>();
    for (const branch of field.conditional.branches) {
      if (branchKeys.has(branch.key)) {
        throw new Error(`validate — ${ctx} conditional branch key "${branch.key}" is duplicated`);
      }
      branchKeys.add(branch.key);

      if (isReferenceBranch(branch)) {
        if (!collectionNames.includes(branch.collection)) {
          throw new Error(
            `validate — ${ctx} conditional branch "${branch.key}" references unknown collection "${branch.collection}"`,
          );
        }
      } else if (branch.fields) {
        for (const [subName, subField] of Object.entries(branch.fields)) {
          if (!VALID_IDENTIFIER.test(subName)) {
            throw new Error(
              `validate — ${ctx} conditional branch "${branch.key}" field "${subName}" is not a valid TypeScript identifier`,
            );
          }
          validateField(collectionNames, collectionKey, `${fieldName}.${branch.key}.${subName}`, subField, allFields);
        }
      }
    }
  }
}

function isReferenceBranch(
  branch: ConditionalBranchConfig,
): branch is ConditionalBranchConfig & { collection: string } {
  return 'collection' in branch && typeof branch.collection === 'string';
}
