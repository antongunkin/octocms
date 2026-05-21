/**
 * Type generation functions — pure functions that produce TypeScript source strings.
 *
 * Moved here from `scripts/generate-types.ts` as part of Phase 4 (CLI).
 * The script now imports these functions; the CLI `types:gen` command calls them directly.
 */

import { FIELD_FORMATS } from '../../schema/fieldFormats';
import type { CollectionField, Config, ConditionalBranchConfig } from '../../types';
import { generateAgentIndex, generateAgentOverview, generateAgentSchema } from './agentDocs';
import { generateSchemaDocs } from './schemaDocs';
import { validateConfig } from './validateConfig';

// Re-exported so existing call sites (`regenerateAll.test.ts`) keep working.
export { FIELD_FORMATS };

export const CODEGEN_BANNER = `/*
 * AUTO-GENERATED — DO NOT EDIT.
 * Generated from cms/schema.json.
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

  // AnyEntry union — wrap to one-per-line when the inline form would exceed
  // oxfmt's 120-char limit, so codegen output matches the formatter.
  const entryNames = collectionNames.map((k) => `${pascalCase(k)}Entry`);
  const inlineAnyEntry = `export type AnyEntry = ${entryNames.join(' | ')};`;
  if (inlineAnyEntry.length > 120) {
    lines.push('export type AnyEntry =');
    entryNames.forEach((name, i) => {
      const suffix = i === entryNames.length - 1 ? ';' : '';
      lines.push(`  | ${name}${suffix}`);
    });
  } else {
    lines.push(inlineAnyEntry);
  }
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
 * Serialize a config value to TypeScript source.
 *
 * Output matches the project's oxfmt style closely enough that no post-format
 * step is needed — important because the visual Content Model editor regenerates
 * this shim from a server action running on Vercel in production, where
 * spawning `oxfmt` (a dev tool) is not possible.
 *
 * Style rules emitted directly:
 *  - Single quotes for strings (escaped if needed).
 *  - Bare keys when the property name is a valid JS identifier; quoted otherwise.
 *  - Trailing commas after every element of multi-line arrays/objects.
 *  - `as const` appended to the `options` / `defaultOptions` arrays of select
 *    fields so option `value` strings narrow to literal-union types.
 *
 * As a safety net, `cms/__generated__/schema.ts` is also listed in oxfmt's
 * `ignorePatterns` (`.oxfmtrc.json`) so any future style drift will not fail
 * `npm run fmt:check`.
 */
const JS_IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const RESERVED = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

function quoteString(s: string): string {
  // Single-quoted; escape backslashes, single quotes, and control chars.
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
}

function formatKey(k: string): string {
  return JS_IDENT.test(k) && !RESERVED.has(k) ? k : quoteString(k);
}

export function serializeConfigToTS(cfg: Config): string {
  function emit(value: unknown, indent: string, parentFieldFormat?: string, key?: string): string {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return quoteString(value);
    if (Array.isArray(value)) {
      const needsAsConst = parentFieldFormat === 'select' && (key === 'options' || key === 'defaultOptions');
      const suffix = needsAsConst ? ' as const' : '';
      if (value.length === 0) return `[]${suffix}`;
      const inner = indent + '  ';
      const items = value.map((v) => `${inner}${emit(v, inner)}`).join(',\n');
      return `[\n${items},\n${indent}]${suffix}`;
    }
    if (typeof value === 'object') {
      const obj = value as Record<string, unknown>;
      const fmt = typeof obj.format === 'string' ? obj.format : undefined;
      const inner = indent + '  ';
      const entries = Object.entries(obj).map(([k, v]) => `${inner}${formatKey(k)}: ${emit(v, inner, fmt, k)}`);
      return `{\n${entries.join(',\n')},\n${indent}}`;
    }
    throw new Error(`Unsupported value type in schema: ${typeof value}`);
  }
  return emit(cfg, '');
}

/**
 * Generate `cms/__generated__/schema.ts` — a TypeScript shim that re-emits
 * `cms/schema.json` as a `defineConfig()` call. This preserves literal types
 * (collection names, field names, field formats, select option values) for the
 * downstream `query()` type inference, which JSON imports cannot do on their own.
 *
 * `cms/schema.json` is the source of truth; this shim mirrors it. `npm run
 * types:check` fails if they drift.
 */
export function generateSchemaShim(cfg: Config): string {
  // Use a relative import (not the `octocms/*` alias) because this file is
  // pulled in by `cms/octocms.config.ts`, which Next.js loads through the
  // CommonJS resolver for `next.config.ts` — that resolver does not honour
  // tsconfig paths. The original hand-written config used the same workaround.
  return (
    CODEGEN_BANNER +
    `import { defineConfig } from '../../octocms/defineConfig';

export const schema = defineConfig(${serializeConfigToTS(cfg)});
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
    `import * as userConfig from '../octocms.config';
import { setConfig } from 'octocms/lib/configStore';
import { setAgentConfig } from 'octocms/agent/configStore';

setConfig(userConfig.configOctoCMS);
if (userConfig.agentConfig) setAgentConfig(userConfig.agentConfig);
`
  );
}

// ---------------------------------------------------------------------------
// regenerateAll — single entry point that produces every schema-driven file
// ---------------------------------------------------------------------------

/**
 * Regenerate every schema-driven artifact in memory and return them as a
 * `path -> content` map. The visual schema-editor server action commits the
 * map as a single batch; the `npm run *:gen` scripts pick the subset they
 * need and write to disk.
 *
 * Throws if the config is invalid (via `validateConfig`).
 *
 * Output paths are repo-relative and stable. Excluded from this map:
 *  - `docs/generated/api-routes.md` — built by scanning `src/app/api/` on disk,
 *    not derivable from the schema. The `generate-docs.ts` script writes it
 *    separately.
 */
export function regenerateAll(cfg: Config): { files: Record<string, string> } {
  const collectionNames = Object.keys(cfg.collections);
  validateConfig(cfg, collectionNames);

  return {
    files: {
      'cms/schema.json': JSON.stringify(cfg, null, 2) + '\n',
      'cms/__generated__/schema.ts': generateSchemaShim(cfg),
      'cms/__generated__/types.ts': generateTypes(cfg, collectionNames),
      'cms/__generated__/enums.ts': generateEnums(cfg, collectionNames, FIELD_FORMATS),
      'cms/__generated__/content.d.ts': generateContentDecls(cfg, collectionNames),
      'cms/__generated__/index.ts': generateIndex(),
      'cms/__generated__/query.ts': generateQuery(),
      'cms/__generated__/configInit.ts': generateConfigInit(),
      'docs/generated/schema.md': generateSchemaDocs(cfg, collectionNames, FIELD_FORMATS),
      'octocms/docs/index.md': generateAgentIndex(),
      'octocms/docs/overview.md': generateAgentOverview(cfg, collectionNames),
      'octocms/docs/schema.md': generateAgentSchema(cfg, collectionNames),
    },
  };
}
