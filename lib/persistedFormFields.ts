import type { CollectionField, Config } from '../admin/types';
import { getConfig } from './configStore';
import { parseColorFieldInput } from './colorField';
import { parseDatetimeFieldInput } from './datetimeField';
import { parseJsonFieldInput } from './jsonField';
import { parseNumberFieldInput } from './numberField';
import { parseSelectFieldInput } from './selectField';
import { parseSlugFieldInput } from './slugField';
import { parseStringListFormRaw } from './stringListField';
import { parseUrlFieldInput } from './urlField';

/**
 * Merge form string values into persisted field shapes (e.g. numbers as JSON numbers, datetimes as ISO strings or null).
 */
export function persistedFieldsFromFormStrings(
  collectionType: string,
  strFields: Record<string, string>,
): Record<string, unknown> {
  const config = getConfig();
  const col = config.collections[collectionType as keyof Config['collections']];
  if (!col) {
    return { ...strFields };
  }

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(strFields)) {
    const def = col.fields[k];
    if (def?.format === 'number') {
      const r = parseNumberFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'datetime') {
      const r = parseDatetimeFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'json') {
      const r = parseJsonFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'string' && def.list) {
      const r = parseStringListFormRaw(v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.items;
    } else if (def?.format === 'slug') {
      const r = parseSlugFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'select') {
      const r = parseSelectFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'text') {
      const trimmed = v.trim();
      if (def.required && !trimmed) {
        throw new Error(`${def.label} is required`);
      }
      out[k] = trimmed;
    } else if (def?.format === 'url') {
      const r = parseUrlFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'color') {
      const r = parseColorFieldInput(def, v);
      if (!r.ok) {
        throw new Error(r.message);
      }
      out[k] = r.value;
    } else if (def?.format === 'markdown' || def?.format === 'richtext') {
      out[k] = v;
    } else if (def?.format === 'conditional') {
      // Conditional fields are stored as a keyed object — parse from JSON string.
      let parsed: unknown;
      try {
        parsed = v ? JSON.parse(v) : {};
      } catch {
        parsed = {};
      }

      if (typeof parsed === 'object' && parsed && !Array.isArray(parsed)) {
        const obj = parsed as Record<string, unknown>;
        const result: Record<string, unknown> = {};

        for (const branch of def.conditional.branches) {
          const branchValue = obj[branch.key];
          if (branch.collection) {
            // Reference branch — store as string ref key
            result[branch.key] = typeof branchValue === 'string' ? branchValue : '';
          } else if (branch.fields) {
            // Inline branch — recursively persist each sub-field
            const branchObj = (
              typeof branchValue === 'object' && branchValue && !Array.isArray(branchValue) ? branchValue : {}
            ) as Record<string, string>;

            const subOut: Record<string, unknown> = {};
            for (const [subK, subDef] of Object.entries(branch.fields)) {
              const subV = branchObj[subK] ?? '';
              const subStr = subV === null || subV === undefined ? '' : String(subV);
              subOut[subK] = persistSingleField(subDef, subStr);
            }
            result[branch.key] = subOut;
          }
        }
        out[k] = result;
      } else {
        out[k] = {};
      }
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Persist a single field value from its form string. Returns the typed value for JSON storage.
 */
function persistSingleField(def: CollectionField, raw: string): unknown {
  switch (def.format) {
    case 'number': {
      const r = parseNumberFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'datetime': {
      const r = parseDatetimeFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'json': {
      const r = parseJsonFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'string':
      if (def.list) {
        const r = parseStringListFormRaw(raw);
        return r.ok ? r.items : raw;
      }
      return raw;
    case 'slug': {
      const r = parseSlugFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'select': {
      const r = parseSelectFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'text':
      return raw.trim();
    case 'url': {
      const r = parseUrlFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    case 'color': {
      const r = parseColorFieldInput(def, raw);
      return r.ok ? r.value : raw;
    }
    default:
      return raw;
  }
}
