import type { SelectCollectionField } from '../admin/types';

export type SelectFieldParseResult = { ok: true; value: string | string[] } | { ok: false; message: string };

function allowedValues(field: SelectCollectionField): Set<string> {
  return new Set(field.options.map((o) => o.value));
}

/**
 * Parse select / multiselect form submission (single: plain string; multiple: JSON array string).
 */
export function parseSelectFieldInput(field: SelectCollectionField, raw: string): SelectFieldParseResult {
  const allowed = allowedValues(field);
  const multiple = field.multiple === true;

  if (multiple) {
    const trimmed = raw.trim();
    if (trimmed === '') {
      if (field.required) {
        return { ok: false, message: `${field.label} is required` };
      }
      return { ok: true, value: [] };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { ok: false, message: `${field.label} has invalid data` };
    }
    if (!Array.isArray(parsed)) {
      return { ok: false, message: `${field.label} must be a JSON array` };
    }
    const strings = parsed.map((p) => String(p));
    for (const s of strings) {
      if (!allowed.has(s)) {
        return { ok: false, message: `${field.label} contains an invalid choice` };
      }
    }
    if (field.required && strings.length === 0) {
      return { ok: false, message: `${field.label} is required` };
    }
    return { ok: true, value: strings };
  }

  const t = raw.trim();
  if (t === '') {
    if (field.required) {
      return { ok: false, message: `${field.label} is required` };
    }
    return { ok: true, value: '' };
  }
  if (!allowed.has(t)) {
    return { ok: false, message: `${field.label} has an invalid choice` };
  }
  return { ok: true, value: t };
}
