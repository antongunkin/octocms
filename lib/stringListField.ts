/**
 * Parse and normalize string list values for `format: 'string'` fields with `list: true`.
 * Form submission uses a hidden input with JSON.stringify(string[]).
 */
export function normalizeStringListFromStorage(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x));
  }
  if (raw == null || raw === '') {
    return [];
  }
  return [String(raw)];
}

export type ParseStringListFormResult = { ok: true; items: string[] } | { ok: false; message: string };

/**
 * Parses the hidden input value: must be JSON array of strings (non-string elements coerced).
 * Empty strings after trim are dropped.
 */
export function parseStringListFormRaw(raw: string): ParseStringListFormResult {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return { ok: true, items: [] };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, message: 'Invalid list data' };
  }
  if (!Array.isArray(parsed)) {
    return { ok: false, message: 'List field must be a JSON array' };
  }
  const items: string[] = [];
  for (const el of parsed) {
    const s = String(el).trim();
    if (s.length > 0) {
      items.push(s);
    }
  }
  return { ok: true, items };
}
