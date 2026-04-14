import type { Config } from '../types';

/** Derive the companion `.md` file path for a markdown field from the entry JSON path. */
export function companionMarkdownPath(entryJsonPath: string, fieldName: string): string {
  const base = entryJsonPath.replace(/\.json$/, '');
  return `${base}.${fieldName}.md`;
}

/** Derive the companion `.mdx` file path for a richtext field from the entry JSON path. */
export function companionRichTextPath(entryJsonPath: string, fieldName: string): string {
  const base = entryJsonPath.replace(/\.json$/, '');
  return `${base}.${fieldName}.mdx`;
}

/** Return field names that have `format: 'markdown'` for the given collection type. */
export function getMarkdownFieldNames(collectionType: string, collections: Config['collections']): string[] {
  const col = (collections as Record<string, any>)[collectionType];
  if (!col) return [];
  return Object.entries(col.fields)
    .filter(([, def]: [string, any]) => def.format === 'markdown')
    .map(([key]) => key);
}

/** Return field names that have `format: 'richtext'` for the given collection type. */
export function getRichTextFieldNames(collectionType: string, collections: Config['collections']): string[] {
  const col = (collections as Record<string, any>)[collectionType];
  if (!col) return [];
  return Object.entries(col.fields)
    .filter(([, def]: [string, any]) => def.format === 'richtext')
    .map(([key]) => key);
}

/** Return a map of `{ fieldName: companionPath }` for all markdown fields in the collection. */
export function companionMarkdownPathsForEntry(
  entryJsonPath: string,
  collectionType: string,
  collections: Config['collections'],
): Record<string, string> {
  const names = getMarkdownFieldNames(collectionType, collections);
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = companionMarkdownPath(entryJsonPath, name);
  }
  return result;
}

/** Return a map of `{ fieldName: companionPath }` for all richtext fields in the collection. */
export function companionRichTextPathsForEntry(
  entryJsonPath: string,
  collectionType: string,
  collections: Config['collections'],
): Record<string, string> {
  const names = getRichTextFieldNames(collectionType, collections);
  const result: Record<string, string> = {};
  for (const name of names) {
    result[name] = companionRichTextPath(entryJsonPath, name);
  }
  return result;
}

/**
 * Return a map of `{ fieldName: companionPath }` for ALL companion-file fields
 * (both markdown `.md` and richtext `.mdx`) in the collection.
 */
export function companionFilePathsForEntry(
  entryJsonPath: string,
  collectionType: string,
  collections: Config['collections'],
): Record<string, string> {
  return {
    ...companionMarkdownPathsForEntry(entryJsonPath, collectionType, collections),
    ...companionRichTextPathsForEntry(entryJsonPath, collectionType, collections),
  };
}
