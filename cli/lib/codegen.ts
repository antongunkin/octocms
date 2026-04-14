/**
 * Type generation functions — pure functions that produce TypeScript source strings.
 *
 * Moved here from `scripts/generate-types.ts` as part of Phase 4 (CLI).
 * The script now imports these functions; the CLI `types:gen` command calls them directly.
 */

import type { CollectionField, Config, ConditionalBranchConfig } from '../../types';

export const CODEGEN_BANNER = `/*
 * AUTO-GENERATED — DO NOT EDIT.
 * Generated from cms/octocms.config.ts.
 * Run \`npx octocms types:gen\` to regenerate.
 */

`;

/** Capitalize the first letter of a string: `post` → `Post`, `homePage` → `HomePage`. */
export function pascalCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Build the TypeScript type string for a single field definition. */
export function fieldToTSType(
  field: CollectionField,
  collectionNames: readonly string[],
  mode: 'resolved' | 'raw' = 'resolved',
): string {
  switch (field.format) {
    case 'string':
      return field.list ? 'string[]' : 'string';
    case 'text':
    case 'markdown':
    case 'slug':
    case 'url':
    case 'color':
      return 'string';
    case 'richtext':
      return 'RichTextDocument';
    case 'boolean':
      return "'true' | 'false'";
    case 'number':
      return 'number | null';
    case 'datetime':
      return 'string | null';
    case 'image':
      return mode === 'raw' ? 'string' : 'ResolvedImageField';
    case 'json':
      return 'unknown';
    case 'select': {
      const union = field.options.map((o) => `'${o.value}'`).join(' | ');
      if (field.multiple) {
        return field.options.length > 1 ? `(${union})[]` : `${union}[]`;
      }
      return union;
    }
    case 'reference': {
      if (mode === 'raw') {
        const cardinality = field.reference?.cardinality ?? 'many';
        return cardinality === 'one' ? 'string' : 'string';
      }
      return referenceFieldType(field, collectionNames);
    }
    case 'conditional': {
      if (mode === 'raw') {
        return 'unknown';
      }
      return conditionalFieldType(field, collectionNames);
    }
    default:
      return 'unknown';
  }
}

function referenceFieldType(
  field: Extract<CollectionField, { format: 'reference' }>,
  collectionNames: readonly string[],
): string {
  const cols = field.reference?.collections ?? (field.collection ? [field.collection] : [...collectionNames]);
  const entryTypes = cols.map((c) => `${pascalCase(c)}Entry`);
  const union = entryTypes.length > 1 ? entryTypes.join(' | ') : entryTypes[0];
  const cardinality = field.reference?.cardinality ?? 'many';
  if (cardinality === 'one') {
    return entryTypes.length > 1 ? `(${union}) | null` : `${union} | null`;
  }
  return entryTypes.length > 1 ? `(${union})[]` : `${union}[]`;
}

function conditionalFieldType(
  field: Extract<CollectionField, { format: 'conditional' }>,
  collectionNames: readonly string[],
): string {
  const branchTypes = field.conditional.branches.map((branch) => branchValueType(branch, collectionNames));
  return branchTypes.join(' | ');
}

function branchValueType(branch: ConditionalBranchConfig, collectionNames: readonly string[]): string {
  if ('collection' in branch && typeof branch.collection === 'string') {
    return `${pascalCase(branch.collection)}Entry`;
  }
  if (branch.fields) {
    const entries = Object.entries(branch.fields);
    if (entries.length === 0) return '{}';
    const props = entries.map(([name, f]) => `  ${name}: ${fieldToTSType(f, collectionNames)};`);
    return `{\n${props.join('\n')}\n}`;
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

export function generateTypes(cfg: Config, collectionNames: readonly string[]): string {
  const lines: string[] = [
    CODEGEN_BANNER + "import type { EntryStatus, ResolvedImageField } from 'octocms/types';",
    '',
  ];

  // Emit Fields interfaces
  for (const key of collectionNames) {
    const col = cfg.collections[key as keyof typeof cfg.collections];
    const pascal = pascalCase(key);
    lines.push(`export interface ${pascal}Fields {`);
    for (const [fieldName, field] of Object.entries(col.fields)) {
      const tsType = fieldToTSType(field, collectionNames);
      lines.push(`  ${fieldName}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');
  }

  // Emit Entry interfaces
  for (const key of collectionNames) {
    const pascal = pascalCase(key);
    lines.push(`export interface ${pascal}Entry {`);
    lines.push(`  sys: { id: string; type: '${key}'; status: EntryStatus };`);
    lines.push(`  fields: ${pascal}Fields;`);
    lines.push('}');
    lines.push('');
  }

  // AnyEntry union
  const entryNames = collectionNames.map((k) => `${pascalCase(k)}Entry`);
  lines.push(`export type AnyEntry = ${entryNames.join(' | ')};`);
  lines.push('');

  // EntryMap
  lines.push('export type EntryMap = {');
  for (const key of collectionNames) {
    lines.push(`  ${key}: ${pascalCase(key)}Entry;`);
  }
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

export function generateEnums(cfg: Config, collectionNames: readonly string[], fieldTypes: readonly string[]): string {
  const lines: string[] = [];

  // CollectionName const object
  lines.push('export const CollectionName = {');
  for (const key of collectionNames) {
    lines.push(`  ${pascalCase(key)}: '${key}',`);
  }
  lines.push('} as const;');
  lines.push('export type CollectionName = (typeof CollectionName)[keyof typeof CollectionName];');
  lines.push('');

  // COLLECTION_NAMES array
  lines.push(`export const COLLECTION_NAMES = [${collectionNames.map((k) => `'${k}'`).join(', ')}] as const;`);
  lines.push('');

  // Select option enums per collection
  for (const key of collectionNames) {
    const col = cfg.collections[key as keyof typeof cfg.collections];
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if (field.format !== 'select') continue;
      const enumName = `${pascalCase(key)}${pascalCase(fieldName)}Option`;
      lines.push(`export const ${enumName} = {`);
      for (const opt of field.options) {
        lines.push(`  ${pascalCase(opt.value)}: '${opt.value}',`);
      }
      lines.push('} as const;');
      lines.push(`export type ${enumName} = (typeof ${enumName})[keyof typeof ${enumName}];`);
      lines.push('');
    }
  }

  // FieldFormat const object
  lines.push('export const FieldFormat = {');
  for (const ft of fieldTypes) {
    lines.push(`  ${pascalCase(ft)}: '${ft}',`);
  }
  lines.push('} as const;');
  lines.push('export type FieldFormat = (typeof FieldFormat)[keyof typeof FieldFormat];');
  lines.push('');

  return CODEGEN_BANNER + lines.join('\n');
}

export function generateContentDecls(cfg: Config, collectionNames: readonly string[]): string {
  const lines: string[] = [
    CODEGEN_BANNER +
      "import type { EntryStatus } from 'octocms/types';\n\n" +
      '// Raw on-disk types (before query() processing).\n' +
      '// Image fields are UUID strings, reference fields are key strings,\n' +
      '// markdown fields are omitted (stored in companion .md files),\n' +
      '// richtext fields are omitted (stored in companion .mdx files).\n',
  ];

  for (const key of collectionNames) {
    const col = cfg.collections[key as keyof typeof cfg.collections];
    const pascal = pascalCase(key);

    lines.push(`export interface Raw${pascal}Fields {`);
    for (const [fieldName, field] of Object.entries(col.fields)) {
      if (field.format === 'markdown' || field.format === 'richtext') continue; // companion files, not in JSON
      const tsType = fieldToTSType(field, collectionNames, 'raw');
      lines.push(`  ${fieldName}: ${tsType};`);
    }
    lines.push('}');
    lines.push('');

    lines.push(`export interface Raw${pascal}Entry {`);
    lines.push(`  sys: { id: string; type: '${key}'; status: EntryStatus };`);
    lines.push(`  fields: Raw${pascal}Fields;`);
    lines.push('}');
    lines.push('');
  }

  // RawEntryMap
  lines.push('export type RawEntryMap = {');
  for (const key of collectionNames) {
    lines.push(`  ${key}: Raw${pascalCase(key)}Entry;`);
  }
  lines.push('};');
  lines.push('');

  return lines.join('\n');
}

export function generateIndex(): string {
  return CODEGEN_BANNER + "export * from './types';\nexport * from './enums';\nexport * from './query';\n";
}

/**
 * Generate the app-specific `query.ts` file that binds `createQuery` from `octocms/query`
 * to the app's config and generated `EntryMap` type.
 *
 * This file is emitted to `cms/__generated__/query.ts` by `npm run types:gen`.
 * Consumers import the typed `query` function from `cms/__generated__/query`.
 */
export function generateQuery(): string {
  return (
    CODEGEN_BANNER +
    `import { createQuery } from 'octocms/query';
import { configOctoCMS, type OctoConfig } from '../octocms.config';
import type { EntryMap } from './types';

// configOctoCMS is widened to Config for admin internals; cast back to OctoConfig so
// createQuery preserves literal collection/field names for type-safe queries.
export const query = createQuery<EntryMap, OctoConfig>(configOctoCMS as unknown as OctoConfig);
`
  );
}

/**
 * Generate `configInit.ts` — a side-effect module that imports the app config
 * and registers it with the `octocms` config store.
 *
 * Importing this file ensures the singleton is populated even in serverless
 * cold starts where `cms/octocms.config.ts` (and therefore `withOctoCMS`) has not run.
 *
 * Emitted to `cms/__generated__/configInit.ts` by `npm run types:gen`.
 */
export function generateConfigInit(): string {
  return (
    CODEGEN_BANNER +
    `import { configOctoCMS } from '../octocms.config';
import { setConfig } from 'octocms/lib/configStore';

setConfig(configOctoCMS);
`
  );
}
