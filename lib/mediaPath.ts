/**
 * Shared media-path helpers.
 *
 * Media entries live in their own top-level folder (`cms/media/` by default),
 * separate from editorial content under `cms/content/`. This module is the
 * single source of truth for that path so callers do not have to recompute it.
 */

import { getConfig } from './configStore';

const DEFAULT_MEDIA_CONTENT_FOLDER = 'cms/media';

/** Folder where media entry JSONs are stored. */
export function mediaContentFolder(): string {
  const cfg = getConfig() as { mediaContentFolder?: unknown };
  const v = cfg.mediaContentFolder;
  return typeof v === 'string' && v.trim() !== '' ? v : DEFAULT_MEDIA_CONTENT_FOLDER;
}

/** Repo-relative path to the media entry JSON for a given media UUID. */
export function mediaEntryPath(id: string): string {
  return `${mediaContentFolder()}/media-${id}.json`;
}

/** True if a file path is a media entry JSON (under the media-content folder). */
export function isMediaEntryPath(p: string): boolean {
  return p.startsWith(`${mediaContentFolder()}/`);
}
