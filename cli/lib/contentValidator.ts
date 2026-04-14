/**
 * Content entry validator — reads JSON files from disk and validates
 * against the CMS schema. Used by `octocms validate`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

import type { Collection, CollectionField, Config } from '../../types';

export type ValidationError = {
  file: string;
  collection: string;
  field?: string;
  message: string;
};

export type ValidationResult = {
  errors: ValidationError[];
  /** Number of entries checked per collection. */
  counts: Record<string, number>;
};

/**
 * Validate all content entries against the CMS schema.
 * Returns a list of errors (empty = everything valid).
 */
export function validateContent(projectRoot: string, config: Config): ValidationResult {
  const errors: ValidationError[] = [];
  const counts: Record<string, number> = {};
  const contentDir = join(projectRoot, config.contentFolder);

  for (const [collectionName, collection] of Object.entries(config.collections)) {
    const collDir = join(contentDir, collectionName);
    if (!existsSync(collDir)) {
      counts[collectionName] = 0;
      continue;
    }

    const jsonFiles = readdirSync(collDir).filter((f) => f.endsWith('.json'));
    counts[collectionName] = jsonFiles.length;

    for (const file of jsonFiles) {
      const filePath = join(collDir, file);
      const fileErrors = validateEntry(filePath, file, collectionName, collection, contentDir, config);
      errors.push(...fileErrors);
    }
  }

  return { errors, counts };
}

function validateEntry(
  filePath: string,
  fileName: string,
  collectionName: string,
  collection: Collection,
  contentDir: string,
  config: Config,
): ValidationError[] {
  const errors: ValidationError[] = [];
  const ctx = { file: fileName, collection: collectionName };

  let raw: string;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch {
    errors.push({ ...ctx, message: 'Could not read file' });
    return errors;
  }

  let entry: Record<string, unknown>;
  try {
    entry = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    errors.push({ ...ctx, message: 'Invalid JSON' });
    return errors;
  }

  // Validate sys
  const sys = entry.sys as Record<string, unknown> | undefined;
  if (!sys || typeof sys !== 'object') {
    errors.push({ ...ctx, message: 'Missing sys object' });
    return errors;
  }
  if (!sys.id) {
    errors.push({ ...ctx, message: 'Missing sys.id' });
  }
  if (sys.type !== collectionName) {
    errors.push({ ...ctx, message: `sys.type is "${String(sys.type)}", expected "${collectionName}"` });
  }

  // Validate fields
  const fields = entry.fields as Record<string, unknown> | undefined;
  if (!fields || typeof fields !== 'object') {
    errors.push({ ...ctx, message: 'Missing fields object' });
    return errors;
  }

  for (const [fieldName, fieldDef] of Object.entries(collection.fields)) {
    const value = fields[fieldName];
    const fieldErrors = validateFieldValue(fieldName, fieldDef, value, contentDir, config, ctx);
    errors.push(...fieldErrors);
  }

  // Check companion files for markdown/richtext fields
  for (const [fieldName, fieldDef] of Object.entries(collection.fields)) {
    if (fieldDef.format === 'markdown') {
      const companionPath = filePath.replace(/\.json$/, `.${fieldName}.md`);
      if (!existsSync(companionPath) && fieldDef.required) {
        errors.push({ ...ctx, field: fieldName, message: `Missing required companion file (.${fieldName}.md)` });
      }
    }
    if (fieldDef.format === 'richtext') {
      const companionPath = filePath.replace(/\.json$/, `.${fieldName}.mdx`);
      if (!existsSync(companionPath) && fieldDef.required) {
        errors.push({ ...ctx, field: fieldName, message: `Missing required companion file (.${fieldName}.mdx)` });
      }
    }
  }

  return errors;
}

function validateFieldValue(
  fieldName: string,
  fieldDef: CollectionField,
  value: unknown,
  contentDir: string,
  config: Config,
  ctx: { file: string; collection: string },
): ValidationError[] {
  const errors: ValidationError[] = [];
  const fctx = { ...ctx, field: fieldName };

  // Skip companion-file formats (not stored in JSON)
  if (fieldDef.format === 'markdown' || fieldDef.format === 'richtext') {
    return errors;
  }

  // Required check
  if (fieldDef.required && (value === undefined || value === null || value === '')) {
    errors.push({ ...fctx, message: `Required field "${fieldDef.label}" is empty` });
    return errors;
  }

  // Skip further checks if value is absent and not required
  if (value === undefined || value === null) return errors;

  switch (fieldDef.format) {
    case 'string': {
      if (fieldDef.list) {
        if (!Array.isArray(value)) {
          errors.push({ ...fctx, message: 'Expected string array' });
        } else if (!value.every((v) => typeof v === 'string')) {
          errors.push({ ...fctx, message: 'All list items must be strings' });
        }
      } else if (typeof value !== 'string') {
        errors.push({ ...fctx, message: 'Expected string' });
      }
      break;
    }
    case 'text':
    case 'slug':
    case 'url':
    case 'color':
    case 'image': {
      if (typeof value !== 'string') {
        errors.push({ ...fctx, message: `Expected string for ${fieldDef.format} field` });
      }
      break;
    }
    case 'boolean': {
      if (value !== 'true' && value !== 'false') {
        errors.push({ ...fctx, message: 'Expected "true" or "false"' });
      }
      break;
    }
    case 'number': {
      if (typeof value !== 'number' && value !== null) {
        errors.push({ ...fctx, message: 'Expected number or null' });
      }
      if (typeof value === 'number') {
        if (fieldDef.min != null && value < fieldDef.min) {
          errors.push({ ...fctx, message: `Value ${value} is below min ${fieldDef.min}` });
        }
        if (fieldDef.max != null && value > fieldDef.max) {
          errors.push({ ...fctx, message: `Value ${value} is above max ${fieldDef.max}` });
        }
      }
      break;
    }
    case 'datetime': {
      if (typeof value === 'string') {
        if (isNaN(Date.parse(value))) {
          errors.push({ ...fctx, message: 'Invalid datetime format' });
        }
      } else if (value !== null) {
        errors.push({ ...fctx, message: 'Expected ISO date string or null' });
      }
      break;
    }
    case 'select': {
      const validValues = new Set(fieldDef.options.map((o) => o.value));
      if (fieldDef.multiple) {
        if (!Array.isArray(value)) {
          errors.push({ ...fctx, message: 'Expected array for multi-select' });
        } else {
          for (const v of value) {
            if (!validValues.has(String(v))) {
              errors.push({ ...fctx, message: `Invalid select value "${String(v)}"` });
            }
          }
        }
      } else {
        if (typeof value !== 'string' || !validValues.has(value)) {
          errors.push({ ...fctx, message: `Invalid select value "${String(value)}"` });
        }
      }
      break;
    }
    case 'reference': {
      const cardinality = fieldDef.reference?.cardinality ?? 'many';
      if (cardinality === 'one') {
        if (typeof value === 'string' && value) {
          validateReferenceTarget(value, fieldDef.reference?.collections, contentDir, config, fctx, errors);
        }
      } else {
        const refs = parseRefs(value);
        for (const ref of refs) {
          validateReferenceTarget(ref, fieldDef.reference?.collections, contentDir, config, fctx, errors);
        }
      }
      break;
    }
    case 'json': {
      // Any JSON value is valid
      break;
    }
    case 'conditional': {
      if (typeof value !== 'object' || value === null) {
        errors.push({ ...fctx, message: 'Expected object for conditional field' });
      }
      break;
    }
  }

  return errors;
}

function parseRefs(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      const arr = JSON.parse(value);
      return Array.isArray(arr) ? arr.map(String) : [];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value.map(String);
  }
  return [];
}

function validateReferenceTarget(
  refKey: string,
  allowedCollections: string[] | undefined,
  contentDir: string,
  config: Config,
  ctx: { file: string; collection: string; field: string },
  errors: ValidationError[],
): void {
  // Reference key format: `collection-id.json`
  const match = refKey.match(/^(\w+)-(.+)\.json$/);
  if (!match) {
    errors.push({ ...ctx, message: `Invalid reference key format: "${refKey}"` });
    return;
  }

  const [, refCollection] = match;
  if (allowedCollections && !allowedCollections.includes(refCollection)) {
    errors.push({
      ...ctx,
      message: `Reference "${refKey}" targets collection "${refCollection}" which is not allowed`,
    });
    return;
  }

  if (!config.collections[refCollection]) {
    errors.push({ ...ctx, message: `Reference "${refKey}" targets unknown collection "${refCollection}"` });
    return;
  }

  const targetPath = join(contentDir, refCollection, refKey);
  if (!existsSync(targetPath)) {
    errors.push({ ...ctx, message: `Reference target "${refKey}" does not exist` });
  }
}
