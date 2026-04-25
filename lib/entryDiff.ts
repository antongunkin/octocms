/**
 * Pure helpers for computing per-field diffs between two parsed entry JSON objects.
 * No I/O, no server-only APIs — safe to import from both server actions and unit tests.
 */

export type FieldDiff =
  | { kind: 'unchanged' }
  | { kind: 'added'; after: unknown }
  | { kind: 'removed'; before: unknown }
  | { kind: 'changed'; before: unknown; after: unknown };

export type ParsedEntry = {
  sys?: Record<string, unknown>;
  fields?: Record<string, unknown>;
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const aKeys = Object.keys(ao);
  const bKeys = Object.keys(bo);
  if (aKeys.length !== bKeys.length) return false;
  for (const k of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return false;
    if (!deepEqual(ao[k], bo[k])) return false;
  }
  return true;
}

/**
 * Compute a per-field diff between two parsed entry objects.
 *
 * - Ignores `sys.*` (status changes are expected on a feature branch and not actionable in a content diff).
 * - `null` or missing JSON entries are treated as "no entry yet on that side".
 */
export function diffEntryFields(before: ParsedEntry | null, after: ParsedEntry | null): Record<string, FieldDiff> {
  const beforeFields = (before?.fields ?? {}) as Record<string, unknown>;
  const afterFields = (after?.fields ?? {}) as Record<string, unknown>;

  const keys = new Set<string>([...Object.keys(beforeFields), ...Object.keys(afterFields)]);
  const result: Record<string, FieldDiff> = {};

  for (const key of keys) {
    const hasBefore = Object.prototype.hasOwnProperty.call(beforeFields, key);
    const hasAfter = Object.prototype.hasOwnProperty.call(afterFields, key);

    if (!hasBefore && hasAfter) {
      result[key] = { kind: 'added', after: afterFields[key] };
    } else if (hasBefore && !hasAfter) {
      result[key] = { kind: 'removed', before: beforeFields[key] };
    } else if (hasBefore && hasAfter) {
      if (deepEqual(beforeFields[key], afterFields[key])) {
        result[key] = { kind: 'unchanged' };
      } else {
        result[key] = { kind: 'changed', before: beforeFields[key], after: afterFields[key] };
      }
    }
  }

  return result;
}

/** Parse an entry JSON string; return null on empty or parse failure. */
export function safeParseEntry(text: string | null): ParsedEntry | null {
  if (text === null || text === '') return null;
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as ParsedEntry;
    }
    return null;
  } catch {
    return null;
  }
}

/** Stringify any value for display in a text-diff hunk. */
export function stringifyFieldValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
