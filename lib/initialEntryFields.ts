import type { Config } from '../admin/types';
import { getConfig } from './configStore';

/**
 * Default `fields` object for a newly created entry (from schema `defaultBoolean`, `defaultOption`, etc.).
 */
export function initialFieldsForNewEntry(collectionType: string): Record<string, unknown> {
  const config = getConfig();
  const col = config.collections[collectionType as keyof Config['collections']];
  if (!col) {
    return {};
  }

  const out: Record<string, unknown> = {};

  for (const [key, def] of Object.entries(col.fields)) {
    if (def.format === 'boolean' && def.defaultBoolean !== undefined) {
      out[key] = def.defaultBoolean ? 'true' : 'false';
      continue;
    }

    if (def.format === 'select') {
      const allowed = new Set(def.options.map((o) => o.value));
      if (def.multiple === true) {
        const raw = def.defaultOptions;
        if (raw?.length) {
          const vals = raw.filter((v) => allowed.has(v));
          if (vals.length > 0) {
            out[key] = vals;
          }
        }
      } else if (def.defaultOption != null && allowed.has(def.defaultOption)) {
        out[key] = def.defaultOption;
      }
    }
  }

  return out;
}
