/**
 * Convert arbitrary text to a URL-safe slug.
 *
 * Equivalent to the slugify package called with `{ lower: true, strict: true }`:
 * - Normalises Unicode (NFKD) and strips combining diacritical marks so
 *   accented characters fall back to their ASCII base (e.g. "café" → "cafe").
 * - Lowercases the result.
 * - Replaces spaces / underscores with hyphens.
 * - Removes all remaining non-alphanumeric, non-hyphen characters.
 * - Collapses consecutive hyphens and trims leading / trailing hyphens.
 */
export function slugify(input: string): string {
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip combining diacritical marks
    .toLowerCase()
    .replace(/[\s_]+/g, '-') // spaces / underscores → hyphen
    .replace(/[^a-z0-9-]/g, '') // strict: remove everything else
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-+|-+$/g, ''); // trim leading / trailing hyphens
}
