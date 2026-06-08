'use server';

import './registerConfig';

import fsPromises from 'fs/promises';
import path from 'path';

import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';
import type { EntryListItem, EntryStatus } from '../../types';

import { getContentFiles, getFile, getFileJson } from './files';
import { isProductionMode } from '../github';
import { getMediaEntries } from './media';
import { getEntryTitleField } from './utils';
import { getStoredEntryListSnapshot, getStoredEntryReferencePaths } from '../store/contentStore';

export const getEntryList = async (collection: string = '**'): Promise<EntryListItem[]> => {
  const config = getConfig();
  const isProd = isProductionMode();
  let storedSnapshot: Awaited<ReturnType<typeof getStoredEntryListSnapshot>> = null;

  if (isProd) {
    try {
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      storedSnapshot = await getStoredEntryListSnapshot(collection, activeBranch);
    } catch {
      // Store unavailable; retain the direct-read recovery path below.
    }
  }

  const files = storedSnapshot ? storedSnapshot.entries.map((entry) => entry.path) : await getContentFiles(collection);
  const storedContentByPath = storedSnapshot
    ? new Map(storedSnapshot.entries.map((entry) => [entry.path, entry.content]))
    : null;

  const mediaById = new Map<string, { publicUrl: string }>();
  if (storedSnapshot) {
    for (const entry of storedSnapshot.mediaEntries) {
      const sys = entry.content.sys as { id?: unknown } | undefined;
      const fields = entry.content.fields as { extension?: unknown } | undefined;
      if (typeof sys?.id === 'string' && typeof fields?.extension === 'string') {
        mediaById.set(sys.id, { publicUrl: `/media/${sys.id}.${fields.extension}` });
      }
    }
  } else {
    // Direct-read recovery and local development still use the existing media
    // action, with one batched call regardless of entry count.
    const mediaList = await getMediaEntries().catch(() => []);
    for (const media of mediaList) {
      mediaById.set(media.id, { publicUrl: media.publicUrl });
    }
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

  const items = await Promise.all(
    files.map(async (file) => {
      const nameWithoutFolder = file.replace(`${config.contentFolder}/`, '').replace('.json', '');
      const parts = nameWithoutFolder.split('/');
      const type = parts[0];
      const id = parts[parts.length - 1];
      const titleField = getEntryTitleField(type);

      let title = id;
      let status: EntryStatus = 'merged';
      let updatedAt: string | undefined;
      let thumbnailUrl: string | undefined;

      const [contentResult, statResult] = await Promise.allSettled([
        storedContentByPath ? Promise.resolve(storedContentByPath.get(file) ?? null) : getFileJson(file),
        isProd ? Promise.resolve(null) : fsPromises.stat(path.join(/*turbopackIgnore: true*/ process.cwd(), file)),
      ]);

      if (contentResult.status === 'fulfilled' && contentResult.value) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const content = contentResult.value as any;
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
      }

      if (!isProd && statResult.status === 'fulfilled' && statResult.value) {
        updatedAt = (statResult.value as { mtime: Date }).mtime.toISOString();
      }

      return { type, id, path: file, title, status, updatedAt, thumbnailUrl };
    }),
  );

  items.sort((a, b) => a.title.localeCompare(b.title));
  return items;
};

/**
 * Find all content entries that reference the given entry via reference fields.
 * Returns entries that contain `targetReferenceKey` in any reference field value.
 */
export const getEntryBacklinks = async (targetReferenceKey: string): Promise<EntryListItem[]> => {
  const config = getConfig();
  let indexedFiles: string[] | null = null;
  if (isProductionMode()) {
    try {
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      indexedFiles = await getStoredEntryReferencePaths(targetReferenceKey, activeBranch);
    } catch {
      // Store unavailable; retain the direct-read recovery path below.
    }
  }

  const allFiles = indexedFiles ?? (await getContentFiles('**'));
  const backlinks: EntryListItem[] = [];

  for (const file of allFiles) {
    try {
      const content = await getFile(file);
      const type = content?.sys?.type;
      if (!type) continue;

      const collection = config.collections[type as keyof Config['collections']];
      if (!collection) continue;

      if (indexedFiles === null) {
        const referenceFieldKeys = Object.keys(collection.fields).filter(
          (k) => collection.fields[k].format === 'reference',
        );
        if (referenceFieldKeys.length === 0) continue;

        let found = false;
        for (const fieldKey of referenceFieldKeys) {
          const fieldValue = content?.fields?.[fieldKey];
          if (!fieldValue) continue;

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
        if (!found) continue;
      }

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
    } catch (_e) {
      // Skip files that can't be read
    }
  }

  return backlinks;
};
