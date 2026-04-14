import type { CollectionField } from '../admin/types';

const HEX6 = /^#([0-9a-f]{6})$/i;
const HEX3 = /^#([0-9a-f]{3})$/i;

/**
 * Expands #rgb to #rrggbb. Returns null if the string is not a valid hex color token.
 */
export function normalizeHexColor(raw: string): string | null {
  const s = raw.trim();
  if (!s) {
    return null;
  }
  const m6 = HEX6.exec(s);
  if (m6) {
    return `#${m6[1]!.toLowerCase()}`;
  }
  const m3 = HEX3.exec(s);
  if (m3) {
    const [r, g, b] = m3[1]!.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

export function parseColorFieldInput(
  def: Pick<CollectionField, 'label' | 'required'>,
  raw: string,
): { ok: true; value: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    if (def.required) {
      return { ok: false, message: `${def.label} is required` };
    }
    return { ok: true, value: '' };
  }
  const normalized = normalizeHexColor(trimmed);
  if (!normalized) {
    return {
      ok: false,
      message: `${def.label} must be a hex color such as #aabbcc or #abc`,
    };
  }
  return { ok: true, value: normalized };
}
