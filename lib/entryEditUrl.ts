import type { EntryListItem } from '../types';

/**
 * Canonical edit URL for a content entry.
 *
 * Media entries live under `/cms/media/<id>` (full-page asset editor) — the
 * legacy `/cms/content/media/<id>` path tries to render `EditPost` against
 * a non-existent collection schema and shows an empty form.
 */
export function entryEditUrl(entry: Pick<EntryListItem, 'type' | 'id'>): string {
  if (entry.type === 'media') return `/cms/media/${entry.id}`;
  return `/cms/content/${entry.type}/${entry.id}`;
}
