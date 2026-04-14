import type { CollectionField } from '../admin/types';

export type NumberFieldParseResult = { ok: true; value: number | null } | { ok: false; message: string };

/**
 * Parse a number field value from form text. Empty optional fields become `null`.
 */
export function parseNumberFieldInput(field: CollectionField, raw: string): NumberFieldParseResult {
  if (field.format !== 'number') {
    throw new Error('parseNumberFieldInput: field is not format "number"');
  }

  const trimmed = raw.trim();
  if (trimmed === '') {
    if (field.required) {
      return { ok: false, message: `${field.label} is required` };
    }
    return { ok: true, value: null };
  }

  const num = Number(trimmed);
  if (!Number.isFinite(num)) {
    return { ok: false, message: `${field.label} must be a valid number` };
  }

  if (field.valueType === 'int' && !Number.isInteger(num)) {
    return { ok: false, message: `${field.label} must be a whole number` };
  }

  if (field.min != null && num < field.min) {
    return { ok: false, message: `${field.label} must be at least ${field.min}` };
  }
  if (field.max != null && num > field.max) {
    return { ok: false, message: `${field.label} must be at most ${field.max}` };
  }

  const stored = field.valueType === 'int' ? Math.trunc(num) : num;
  return { ok: true, value: stored };
}
