import { z } from 'zod';

import type { CollectionField, Config, ConditionalCollectionField, ReferenceFieldConfig } from '../admin/types';
import { getConfig } from './configStore';
import { parseDatetimeFieldInput } from './datetimeField';
import { parseJsonFieldInput } from './jsonField';
import { parseNumberFieldInput } from './numberField';
import { parseSelectFieldInput } from './selectField';
import { parseColorFieldInput } from './colorField';
import { parseSlugFieldInput } from './slugField';
import { parseStringListFormRaw } from './stringListField';
import { parseUrlFieldInput } from './urlField';

function parseReferencePaths(raw: string, cardinality: 'one' | 'many'): string[] {
  if (cardinality === 'one') {
    const t = raw.trim();
    return t ? [t] : [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => String(p));
  } catch {
    return [];
  }
}

function validateReferenceField(
  field: { label: string; required?: boolean; reference?: ReferenceFieldConfig },
  raw: string,
): string | null {
  const cardinality = field.reference?.cardinality ?? 'many';
  const paths = parseReferencePaths(raw, cardinality);
  const max = cardinality === 'one' ? 1 : field.reference?.max;

  const minFromRef = field.reference?.min ?? 0;
  const minFromRequired = field.required ? 1 : 0;
  const effectiveMin = Math.max(minFromRef, minFromRequired);

  if (cardinality === 'one') {
    const count = paths.length > 0 && paths[0] ? 1 : 0;
    if (effectiveMin > 0 && count < 1) {
      return `${field.label} is required`;
    }
    if (max === 1 && paths.length > 1) {
      return `${field.label} allows only one item`;
    }
    return null;
  }

  if (paths.length < effectiveMin) {
    return effectiveMin === 1
      ? `${field.label} is required`
      : `At least ${effectiveMin} items required for ${field.label}`;
  }
  if (max != null && paths.length > max) {
    return `At most ${max} items allowed for ${field.label}`;
  }
  return null;
}

/**
 * Validates CMS entry field values from the editor form against collection config (Zod + reference rules).
 */
export function validateEntryFields(
  collectionType: string,
  fields: Record<string, string>,
): { ok: true } | { ok: false; fieldErrors: Record<string, string> } {
  const config = getConfig();
  const col = config.collections[collectionType as keyof Config['collections']];
  if (!col) {
    return { ok: true };
  }

  const fieldErrors: Record<string, string> = {};

  for (const [key, def] of Object.entries(col.fields)) {
    const raw = fields[key] ?? '';
    let message: string | null = null;

    switch (def.format) {
      case 'string': {
        if (def.list) {
          const parsed = parseStringListFormRaw(raw);
          if (!parsed.ok) {
            message = parsed.message;
          } else if (def.required && parsed.items.length === 0) {
            message = `${def.label} is required`;
          }
        } else {
          const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
          const parsed = schema.safeParse(raw);
          if (!parsed.success) {
            message = parsed.error.issues[0]?.message ?? 'Invalid value';
          }
        }
        break;
      }
      case 'text': {
        const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          message = parsed.error.issues[0]?.message ?? 'Invalid value';
        }
        break;
      }
      case 'markdown':
      case 'richtext': {
        const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          message = parsed.error.issues[0]?.message ?? 'Invalid value';
        }
        break;
      }
      case 'image': {
        const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
        const parsed = schema.safeParse(raw);
        if (!parsed.success) {
          message = parsed.error.issues[0]?.message ?? 'Invalid value';
        }
        break;
      }
      case 'boolean': {
        const parsed = z.enum(['true', 'false']).safeParse(raw);
        if (!parsed.success) {
          message = `${def.label} is invalid`;
        }
        break;
      }
      case 'number': {
        const parsed = parseNumberFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'datetime': {
        const parsed = parseDatetimeFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'reference': {
        message = validateReferenceField(def, raw);
        break;
      }
      case 'json': {
        const parsed = parseJsonFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'slug': {
        const parsed = parseSlugFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'select': {
        const parsed = parseSelectFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'url': {
        const parsed = parseUrlFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'color': {
        const parsed = parseColorFieldInput(def, raw);
        if (!parsed.ok) {
          message = parsed.message;
        }
        break;
      }
      case 'conditional': {
        message = validateConditionalField(def, raw, key, fieldErrors);
        break;
      }
      default:
        break;
    }

    if (message) {
      fieldErrors[key] = message;
    }
  }

  return Object.keys(fieldErrors).length === 0 ? { ok: true } : { ok: false, fieldErrors };
}

/**
 * Validate all branches of a conditional field. Populates `fieldErrors` with dot-path keys
 * (e.g. `hero.image.src`) for nested branch field errors. Returns a top-level message or null.
 */
function validateConditionalField(
  def: ConditionalCollectionField,
  raw: string,
  parentKey: string,
  fieldErrors: Record<string, string>,
): string | null {
  let obj: Record<string, unknown>;
  try {
    obj = raw ? JSON.parse(raw) : {};
  } catch {
    return `${def.label} has invalid data`;
  }

  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return `${def.label} must be an object`;
  }

  for (const branch of def.conditional.branches) {
    const branchValue = obj[branch.key];

    if (branch.collection) {
      // Reference branch — validate the ref key is a non-empty string when required
      if (def.required && (!branchValue || typeof branchValue !== 'string' || !String(branchValue).trim())) {
        fieldErrors[`${parentKey}.${branch.key}`] = `${branch.label} reference is required`;
      }
    } else if (branch.fields) {
      // Inline branch — validate each sub-field
      const branchObj = (
        typeof branchValue === 'object' && branchValue && !Array.isArray(branchValue) ? branchValue : {}
      ) as Record<string, unknown>;

      for (const [subKey, subDef] of Object.entries(branch.fields)) {
        const subRaw = branchObj[subKey] ?? '';
        const subStr = subRaw === null || subRaw === undefined ? '' : String(subRaw);
        const subMessage = validateSingleField(subDef, subStr);
        if (subMessage) {
          fieldErrors[`${parentKey}.${branch.key}.${subKey}`] = subMessage;
        }
      }
    }
  }

  return null;
}

/**
 * Validate a single field value against its definition. Returns an error message or null.
 * Reuses the same logic as the main switch but for a single field.
 */
function validateSingleField(def: CollectionField, raw: string): string | null {
  switch (def.format) {
    case 'string': {
      if (def.list) {
        const parsed = parseStringListFormRaw(raw);
        if (!parsed.ok) return parsed.message;
        if (def.required && parsed.items.length === 0) return `${def.label} is required`;
      } else {
        const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
        const parsed = schema.safeParse(raw);
        if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Invalid value';
      }
      return null;
    }
    case 'text':
    case 'markdown':
    case 'richtext':
    case 'image': {
      const schema = def.required ? z.string().trim().min(1, `${def.label} is required`) : z.string();
      const parsed = schema.safeParse(raw);
      if (!parsed.success) return parsed.error.issues[0]?.message ?? 'Invalid value';
      return null;
    }
    case 'boolean': {
      const parsed = z.enum(['true', 'false']).safeParse(raw);
      if (!parsed.success) return `${def.label} is invalid`;
      return null;
    }
    case 'number': {
      const parsed = parseNumberFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'datetime': {
      const parsed = parseDatetimeFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'reference': {
      return validateReferenceField(def, raw);
    }
    case 'json': {
      const parsed = parseJsonFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'slug': {
      const parsed = parseSlugFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'select': {
      const parsed = parseSelectFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'url': {
      const parsed = parseUrlFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'color': {
      const parsed = parseColorFieldInput(def, raw);
      return parsed.ok ? null : parsed.message;
    }
    case 'conditional': {
      // Nested conditional — recursive validation
      const nestedErrors: Record<string, string> = {};
      const msg = validateConditionalField(def, raw, '', nestedErrors);
      if (msg) return msg;
      // If there are nested errors, return the first one
      const firstErr = Object.values(nestedErrors)[0];
      return firstErr ?? null;
    }
    default:
      return null;
  }
}
