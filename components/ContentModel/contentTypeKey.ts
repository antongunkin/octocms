/**
 * Pure helpers for turning a human-friendly label into a collection key
 * (JS identifier) and validating the result. Used by the Create / Edit
 * Content Type dialogs.
 *
 * The collection key must satisfy `validateConfig`'s rule:
 *   /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
 * i.e. a valid TypeScript identifier. We slugify in camelCase to match the
 * style used throughout the existing schema (`post`, `homePage`, `media`).
 */

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Convert "Blog Post" → "blogPost". Returns "" when nothing usable remains. */
export function slugifyKey(label: string): string {
  const cleaned = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9_$ ]+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const head = words[0].toLowerCase();
  const tail = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  let key = [head, ...tail].join('');

  // Identifiers cannot start with a digit — prefix with `_`.
  if (/^[0-9]/.test(key)) key = `_${key}`;
  return key;
}

export function isValidContentTypeKey(key: string): boolean {
  return VALID_IDENTIFIER.test(key);
}

/** Human-readable explanation of why a key is invalid; null when valid. */
export function describeInvalidKey(key: string): string | null {
  if (!key) return 'API identifier is required.';
  if (!VALID_IDENTIFIER.test(key)) {
    return 'Must start with a letter, $ or _, and contain only letters, digits, $ and _.';
  }
  return null;
}
