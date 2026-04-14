import type { CollectionField, ConditionalBranchConfig, ConditionalCollectionField } from '../admin/types';

export type ConditionalFieldParseResult = { ok: true; value: Record<string, unknown> } | { ok: false; message: string };

/**
 * Validate that every branch key in the config exists in the stored value
 * and return the parsed keyed object.
 */
export function parseConditionalFieldValue(
  field: ConditionalCollectionField,
  raw: unknown,
): ConditionalFieldParseResult {
  const branches = field.conditional.branches;

  if (raw === null || raw === undefined || raw === '') {
    if (field.required) {
      return { ok: false, message: `${field.label} is required` };
    }
    const empty: Record<string, unknown> = {};
    for (const b of branches) {
      empty[b.key] = b.fields ? {} : '';
    }
    return { ok: true, value: empty };
  }

  let obj: Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ok: false, message: `${field.label} must be a valid JSON object` };
    }
  } else if (typeof raw === 'object' && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  } else {
    return { ok: false, message: `${field.label} must be an object keyed by branch key` };
  }

  return { ok: true, value: obj };
}

/**
 * Get the branch config by key. Returns `undefined` if not found.
 */
export function getBranchConfig(
  field: ConditionalCollectionField,
  branchKey: string,
): ConditionalBranchConfig | undefined {
  return field.conditional.branches.find((b) => b.key === branchKey);
}

/**
 * Validate that all branch keys in a conditional field config are unique and non-empty.
 */
export function validateConditionalConfig(field: ConditionalCollectionField): string | null {
  const branches = field.conditional.branches;

  if (!branches || branches.length === 0) {
    return `${field.label}: conditional field must have at least one branch`;
  }

  const keys = new Set<string>();
  for (const b of branches) {
    if (!b.key || typeof b.key !== 'string') {
      return `${field.label}: every branch must have a non-empty string key`;
    }
    if (keys.has(b.key)) {
      return `${field.label}: duplicate branch key "${b.key}"`;
    }
    keys.add(b.key);

    const raw = b as Record<string, unknown>;
    if (!raw.fields && !raw.collection) {
      return `${field.label}: branch "${raw.key}" must have either fields or collection`;
    }
  }

  return null;
}

/**
 * Get the field definitions for an inline branch, or `null` for reference branches.
 */
export function getInlineBranchFields(branch: ConditionalBranchConfig): Record<string, CollectionField> | null {
  return branch.fields ?? null;
}

/**
 * Returns `true` if the branch is a reference branch (points to a collection).
 */
export function isReferenceBranch(branch: ConditionalBranchConfig): branch is ConditionalBranchConfig & {
  collection: string;
} {
  return !!branch.collection;
}

/**
 * Rebuild conditional field values from a flat FormData-style fields record.
 *
 * The form has:
 * - A hidden input `hero` with the initial (possibly stale) JSON
 * - Sub-field inputs like `hero.image.src`, `hero.text.headline`, `hero.ref` (for reference branches)
 *
 * This function constructs the correct nested object from the dot-path keys and
 * updates the main field key. It also removes the dot-path entries from the fields record.
 */
export function rebuildConditionalFields(
  collectionFields: Record<string, CollectionField>,
  fields: Record<string, string>,
): void {
  for (const [fieldName, def] of Object.entries(collectionFields)) {
    if (def.format !== 'conditional') continue;

    const branches = def.conditional.branches;
    const result: Record<string, unknown> = {};

    for (const branch of branches) {
      if (branch.collection) {
        // Reference branch — value is at `fieldName.branchKey`
        const refKey = `${fieldName}.${branch.key}`;
        result[branch.key] = fields[refKey] ?? '';
        delete fields[refKey];
      } else if (branch.fields) {
        // Inline branch — sub-fields at `fieldName.branchKey.subFieldName`
        const branchObj: Record<string, string> = {};
        for (const subKey of Object.keys(branch.fields)) {
          const dotKey = `${fieldName}.${branch.key}.${subKey}`;
          if (dotKey in fields) {
            branchObj[subKey] = fields[dotKey];
            delete fields[dotKey];
          }
        }
        result[branch.key] = branchObj;
      }
    }

    fields[fieldName] = JSON.stringify(result);
  }
}
