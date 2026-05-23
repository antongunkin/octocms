import type { CollectionField } from '../admin/types';

import { slugify } from './slugify';

/** Stored slugs and URL segments must match this pattern (after normalization). */
export const SLUG_MAX_LENGTH = 200;

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlugPattern(s: string): boolean {
  return s.length > 0 && s.length <= SLUG_MAX_LENGTH && SLUG_REGEX.test(s);
}

/**
 * Normalizes text as the user types in the slug field: lowercase, spaces and
 * underscores become hyphens, other invalid characters are removed, hyphens
 * collapsed. Leading hyphens are stripped; a trailing hyphen is kept while typing.
 */
export function sanitizeSlugFieldInputValue(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/[\s_]+/g, '-');
  s = s.replace(/[^a-z0-9-]+/g, '');
  s = s.replace(/-+/g, '-');
  s = s.replace(/^-+/, '');
  if (s.length > SLUG_MAX_LENGTH) {
    s = s.slice(0, SLUG_MAX_LENGTH);
  }
  return s;
}

/**
 * Turn arbitrary text (e.g. entry title) into a URL slug segment.
 * Lowercase, hyphen-separated, ASCII alphanumerics only (`strict` mode).
 * Underscores are treated like spaces so words stay separated.
 */
export function slugifyForUrl(input: string): string {
  const trimmed = String(input).trim();
  const preprocessed = trimmed.replace(/&/g, ' and ').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!preprocessed) {
    return '';
  }
  const raw = slugify(preprocessed);
  let collapsed = raw.replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (collapsed.length > SLUG_MAX_LENGTH) {
    collapsed = collapsed.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
  }
  return collapsed;
}

/**
 * Normalize a slug already stored in JSON for comparison (idempotent for valid slugs).
 */
export function normalizeStoredSlug(raw: string): string {
  return slugifyForUrl(raw);
}

export function parseSlugFieldInput(
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
  const candidate = slugifyForUrl(trimmed);
  if (!isValidSlugPattern(candidate)) {
    return {
      ok: false,
      message: `${def.label} must be a URL-safe slug (lowercase letters, numbers, hyphens only)`,
    };
  }
  return { ok: true, value: candidate };
}
