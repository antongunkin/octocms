import type { MediaFile } from '../../types';

/** Match dashboard / legacy URLs: id or `media-<id>` filename stem. */
export function findMediaFileByRequestedId(requested: string, list: MediaFile[]): MediaFile | undefined {
  const trimmed = requested.trim();
  const direct = list.find((f) => f.id === trimmed);
  if (direct) return direct;
  if (trimmed.startsWith('media-')) {
    const stripped = trimmed.slice('media-'.length);
    return list.find((f) => f.id === stripped);
  }
  return undefined;
}
