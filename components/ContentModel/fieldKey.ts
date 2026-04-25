/**
 * Pure helpers for turning a human-friendly field label into a JS-identifier
 * key, and for validating manually-entered keys. Used by the Add / Edit Field
 * dialogs.
 *
 * Mirrors `validateConfig`'s rule:
 *   /^[a-zA-Z_$][a-zA-Z0-9_$]*$/
 *
 * Field keys appear inside generated TypeScript types (`<Collection>Entry['fields'][<Key>]`)
 * so they must be valid TS identifiers — the same rule used for collection keys.
 */

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

/** Convert "Cover Image" → "coverImage". Returns "" when nothing usable remains. */
export function slugifyFieldKey(label: string): string {
  const cleaned = label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9_$ ]+/g, ' ')
    .trim();
  if (!cleaned) return '';

  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const head = words[0].toLowerCase();
  const tail = words.slice(1).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
  let key = [head, ...tail].join('');

  if (/^[0-9]/.test(key)) key = `_${key}`;
  return key;
}

export function isValidFieldKey(key: string): boolean {
  return VALID_IDENTIFIER.test(key);
}

/** Human-readable explanation of why a key is invalid; null when valid. */
export function describeInvalidFieldKey(key: string): string | null {
  if (!key) return 'Field key is required.';
  if (!VALID_IDENTIFIER.test(key)) {
    return 'Must start with a letter, $ or _, and contain only letters, digits, $ and _.';
  }
  return null;
}
