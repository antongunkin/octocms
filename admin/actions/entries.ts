'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';
import type { EntryListItem, EntryStatus } from '../../types';

import { getContentFiles, getFile } from './files';
import { isProductionMode } from '../github';
import { getMediaEntries } from './media';
import { getEntryTitleField } from './utils';

export const getEntryList = async (collection: string = '**'): Promise<EntryListItem[]> => {
  const config = getConfig();
  const files = await getContentFiles(collection);
  const entries: EntryListItem[] = [];

  // Build a media lookup so we can resolve thumbnail URLs for any entry that
  // has an `image` field. One batched call regardless of entry count.
  const mediaList = await getMediaEntries().catch(() => []);
  const mediaById = new Map<string, { ext: string; publicUrl: string }>();
  for (const m of mediaList) {
    mediaById.set(m.id, { ext: m.extension, publicUrl: m.publicUrl });
  }

  const imageFieldKeyByType = new Map<string, string | null>();
  function firstImageFieldKey(type: string): string | null {
    if (imageFieldKeyByType.has(type)) return imageFieldKeyByType.get(type) ?? null;
    const collection = (config as Config).collections[type as keyof Config['collections']];
    if (!collection) {
      imageFieldKeyByType.set(type, null);
      return null;
    }
    const key = Object.keys(collection.fields).find((k) => collection.fields[k].format === 'image') ?? null;
    imageFieldKeyByType.set(type, key);
    return key;
  }

  for (const file of files) {
    const nameWithoutFolder = file.replace(`${config.contentFolder}/`, '').replace('.json', '');
    const parts = nameWithoutFolder.split('/');
    const type = parts[0];
    const id = parts[parts.length - 1];
    const titleField = getEntryTitleField(type);

    let title = id;
    let status: EntryStatus = 'merged';
    let updatedAt: string | undefined;
    let thumbnailUrl: string | undefined;

    try {
      const content = await getFile(file);

      if (titleField && content?.fields?.[titleField]) {
        title = content.fields[titleField];
      }
      const imgKey = firstImageFieldKey(type);
      if (imgKey) {
        const value = content?.fields?.[imgKey];
        if (typeof value === 'string' && value.trim()) {
          const hit = mediaById.get(value.trim());
          if (hit) thumbnailUrl = hit.publicUrl;
        }
      }
      if (content?.sys?.status) {
        status = content.sys.status;
      }
    } catch (_e) {
      // Fall back to id as title
    }

    if (!isProductionMode()) {
      try {
        const stat = await fsPromises.stat(path.join(/*turbopackIgnore: true*/ process.cwd(), file));
        updatedAt = stat.mtime.toISOString();
      } catch {
        // ignore
      }
    }

    entries.push({ type, id, path: file, title, status, updatedAt, thumbnailUrl });
  }

  entries.sort((a, b) => a.title.localeCompare(b.title));
  return entries;
};

/**
 * Find all content entries that reference the given entry via reference fields.
 * Returns entries that contain `targetReferenceKey` in any reference field value.
 */
export const getEntryBacklinks = async (targetReferenceKey: string): Promise<EntryListItem[]> => {
  const config = getConfig();
  const allFiles = await getContentFiles('**');
  const backlinks: EntryListItem[] = [];

  for (const file of allFiles) {
    try {
      const content = await getFile(file);
      const type = content?.sys?.type;
      if (!type) continue;

      const collection = config.collections[type as keyof Config['collections']];
      if (!collection) continue;

      const referenceFieldKeys = Object.keys(collection.fields).filter(
        (k) => collection.fields[k].format === 'reference',
      );
      if (referenceFieldKeys.length === 0) continue;

      let found = false;
      for (const fieldKey of referenceFieldKeys) {
        const fieldValue = content?.fields?.[fieldKey];
        if (!fieldValue) continue;

        // Reference values can be a single string (cardinality 'one') or a JSON array string (cardinality 'many')
        let keys: string[] = [];
        if (typeof fieldValue === 'string') {
          try {
            const parsed = JSON.parse(fieldValue);
            keys = Array.isArray(parsed) ? parsed : [fieldValue];
          } catch {
            keys = [fieldValue];
          }
        } else if (Array.isArray(fieldValue)) {
          keys = fieldValue;
        }

        if (keys.includes(targetReferenceKey)) {
          found = true;
          break;
        }
      }

      if (found) {
        const nameWithoutFolder = file.replace(`${config.contentFolder}/`, '').replace('.json', '');
        const parts = nameWithoutFolder.split('/');
        const id = parts[parts.length - 1];
        const titleField = getEntryTitleField(type);
        let title = id;
        if (titleField && content?.fields?.[titleField]) {
          title = content.fields[titleField];
        }
        const status: EntryStatus = content?.sys?.status || 'merged';
        backlinks.push({ type, id, path: file, title, status });
      }
    } catch (_e) {
      // Skip files that can't be read
    }
  }

  return backlinks;
};
