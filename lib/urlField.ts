import type { CollectionField } from '../admin/types';

function isAllowedCmsUrl(s: string): boolean {
  if (s.startsWith('https://') || s.startsWith('http://')) {
    return true;
  }
  if (s.startsWith('/')) {
    return !s.startsWith('//');
  }
  return false;
}

export function parseUrlFieldInput(
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
  if (!isAllowedCmsUrl(trimmed)) {
    return {
      ok: false,
      message: `${def.label} must start with http://, https://, or / (root-relative path)`,
    };
  }
  return { ok: true, value: trimmed };
}
