import type { CollectionField } from '../admin/types';

/** Max textarea length for JSON fields (raw string before parse). */
export const JSON_FIELD_MAX_RAW_CHARS = 100_000;

export type JsonFieldParseResult = { ok: true; value: unknown | null } | { ok: false; message: string };

/**
 * Serialize a stored JSON field value for the editor textarea.
 * Native objects/arrays from disk become pretty-printed JSON; legacy string values pass through.
 */
export function jsonFieldValueToFormString(raw: unknown): string {
  if (raw === undefined || raw === null) {
    return '';
  }
  if (typeof raw === 'string') {
    return raw;
  }
  try {
    return JSON.stringify(raw, null, 2);
  } catch {
    return '';
  }
}

/**
 * Parse and validate a JSON field from form text. Empty optional fields become `null`.
 */
export function parseJsonFieldInput(field: CollectionField, raw: string): JsonFieldParseResult {
  if (field.format !== 'json') {
    throw new Error('parseJsonFieldInput: field is not format "json"');
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    if (field.required) {
      return { ok: false, message: `${field.label} is required` };
    }
    return { ok: true, value: null };
  }

  if (raw.length > JSON_FIELD_MAX_RAW_CHARS) {
    return {
      ok: false,
      message: `${field.label} must be at most ${JSON_FIELD_MAX_RAW_CHARS.toLocaleString()} characters`,
    };
  }

  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch {
    return { ok: false, message: `${field.label} must be valid JSON` };
  }
}
