import type { CollectionField } from '../admin/types';

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local `datetime-local` value (no timezone suffix). */
export function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Local `date` input value (YYYY-MM-DD). */
export function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Convert stored ISO (full or date-only) to the value expected by `<input type="datetime-local">` or `<input type="date">`.
 */
export function storedDatetimeToFormInput(stored: string | null | undefined, dateOnly: boolean): string {
  const t = stored == null ? '' : String(stored).trim();
  if (!t) {
    return '';
  }
  if (dateOnly) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return t;
    }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    return toDateInputValue(d);
  }
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return toDatetimeLocalValue(d);
}

/**
 * Convert a browser date/datetime-local string to persisted ISO 8601 (UTC for date-time, calendar date for date-only).
 */
export function formInputToStoredIso(trimmed: string, dateOnly: boolean): string {
  if (dateOnly) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      throw new Error('Invalid date');
    }
    const [y, m, day] = trimmed.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    if (d.getFullYear() !== y || d.getMonth() !== m - 1 || d.getDate() !== day) {
      throw new Error('Invalid date');
    }
    return trimmed;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Invalid datetime');
  }
  return d.toISOString();
}

export type DatetimeFieldParseResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * Parse a datetime field value from form text. Empty optional fields become `null`.
 */
export function parseDatetimeFieldInput(field: CollectionField, raw: string): DatetimeFieldParseResult {
  if (field.format !== 'datetime') {
    throw new Error('parseDatetimeFieldInput: field is not format "datetime"');
  }

  const dateOnly = field.dateOnly === true;
  const trimmed = raw.trim();
  if (trimmed === '') {
    if (field.required) {
      return { ok: false, message: `${field.label} is required` };
    }
    return { ok: true, value: null };
  }

  try {
    return { ok: true, value: formInputToStoredIso(trimmed, dateOnly) };
  } catch {
    return {
      ok: false,
      message: `${field.label} must be a valid ${dateOnly ? 'date' : 'date and time'}`,
    };
  }
}
