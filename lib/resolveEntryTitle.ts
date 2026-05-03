/**
 * Pure helpers for deriving an entry's display title and identity from the
 * config + the parsed entry JSON.
 *
 * Extracted from `octocms/admin/actions/entries.ts` so non-admin code paths
 * (e.g. the chat agent's `searchContent`) can resolve titles without pulling
 * in `'use server'` modules. The admin `getEntryList` is a thin wrapper that
 * adds disk I/O on top of these helpers.
 */

import type { Config } from '../admin/types';

/** Locate the field marked `entryTitle: true` on the given collection, if any. */
export function getEntryTitleField(config: Config, collectionName: string): string | undefined {
  const collection = config.collections[collectionName as keyof Config['collections']];
  if (!collection) return undefined;
  return Object.keys(collection.fields).find((key) => collection.fields[key].entryTitle);
}

/** Default fallback: filename stem without folder prefix or `.json` extension. */
export function defaultEntryId(config: Config, filePath: string): string {
  const stripped = filePath.replace(`${config.contentFolder}/`, '').replace('.json', '');
  const parts = stripped.split('/');
  return parts[parts.length - 1] ?? stripped;
}

/** Return the collection name (= `sys.type` segment) for a given content file path.
 *  Recognises media-entry paths under `mediaContentFolder` and returns `'media'`. */
export function collectionFromPath(config: Config, filePath: string): string {
  const mediaFolder = (config as Config & { mediaContentFolder?: string }).mediaContentFolder ?? 'cms/media';
  if (filePath.startsWith(`${mediaFolder}/`)) return 'media';
  const stripped = filePath.replace(`${config.contentFolder}/`, '').replace('.json', '');
  const parts = stripped.split('/');
  return parts[0] ?? '';
}

type EntryPayload = {
  sys?: { id?: unknown; type?: unknown };
  fields?: Record<string, unknown>;
};

/**
 * Resolve a human-readable title from the entry payload, falling back to the
 * filename stem when no title field is configured or populated. Mirrors
 * `getEntryList` exactly so search hits and the entry list agree.
 */
export function resolveEntryTitle(config: Config, filePath: string, entry: EntryPayload | null | undefined): string {
  const fallback = defaultEntryId(config, filePath);
  if (!entry) return fallback;

  const collectionType = typeof entry.sys?.type === 'string' ? entry.sys.type : collectionFromPath(config, filePath);

  // Media entries store their display name on `fields.title` regardless of schema.
  if (collectionType === 'media') {
    const mediaTitle = entry.fields?.title;
    if (typeof mediaTitle === 'string' && mediaTitle.trim() !== '') return mediaTitle.trim();
    return fallback;
  }

  const titleField = getEntryTitleField(config, collectionType);
  if (titleField) {
    const value = entry.fields?.[titleField];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  }

  return fallback;
}

/**
 * Resolve the entry id — `sys.id` for media (kept for parity with `getEntryList`),
 * filename stem for everything else.
 */
export function resolveEntryId(config: Config, filePath: string, entry: EntryPayload | null | undefined): string {
  const fallback = defaultEntryId(config, filePath);
  if (!entry) return fallback;
  const collectionType = typeof entry.sys?.type === 'string' ? entry.sys.type : collectionFromPath(config, filePath);
  if (collectionType === 'media') {
    const sysId = entry.sys?.id;
    if (typeof sysId === 'string' && sysId !== '') return sysId;
  }
  return fallback;
}

/**
 * Build a short text excerpt for search hits — picks the first non-title
 * text-like field, trims and ellipsizes to `maxLen`. Works without companion
 * markdown content, so callers don't need to do another disk read.
 */
export function buildEntryExcerpt(
  config: Config,
  filePath: string,
  entry: EntryPayload | null | undefined,
  maxLen = 200,
): string {
  if (!entry?.fields) return '';
  const collectionType = typeof entry.sys?.type === 'string' ? entry.sys.type : collectionFromPath(config, filePath);
  const titleField = getEntryTitleField(config, collectionType);
  const collection = config.collections[collectionType as keyof Config['collections']];
  if (!collection) return '';

  const candidateFormats = new Set(['text', 'markdown', 'richtext', 'string']);
  for (const [fieldKey, fieldDef] of Object.entries(collection.fields)) {
    if (fieldKey === titleField) continue;
    if (!candidateFormats.has(fieldDef.format)) continue;
    const value = entry.fields[fieldKey];
    const text = stringifyForExcerpt(value);
    if (text) return truncate(text, maxLen);
  }
  return '';
}

function stringifyForExcerpt(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value))
    return value
      .filter((v) => typeof v === 'string')
      .join(', ')
      .trim();
  return '';
}

function truncate(text: string, maxLen: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim();
  if (collapsed.length <= maxLen) return collapsed;
  return collapsed.slice(0, maxLen - 1).trimEnd() + '…';
}
