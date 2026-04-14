'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';
import type { EntryListItem, EntryStatus } from '../../types';

import { getContentFiles, getFile } from './files';
import { isProductionMode } from '../github';
import { getEntryTitleField } from './utils';

export const getEntryList = async (collection: string = '**'): Promise<EntryListItem[]> => {
  const config = getConfig();
  const files = await getContentFiles(collection);
  const entries: EntryListItem[] = [];

  for (const file of files) {
    const nameWithoutFolder = file.replace(`${config.contentFolder}/`, '').replace('.json', '');
    const parts = nameWithoutFolder.split('/');
    const type = parts[0];
    let id = parts[parts.length - 1];
    const titleField = getEntryTitleField(type);

    let title = id;
    let status: EntryStatus = 'merged';
    let updatedAt: string | undefined;

    try {
      const content = await getFile(file);

      if (type === 'media') {
        const sysId = content?.sys && typeof content.sys === 'object' && 'id' in content.sys ? content.sys.id : null;
        if (typeof sysId === 'string' && sysId !== '') {
          id = sysId;
        }
        const mediaTitle = content?.fields?.title;
        if (typeof mediaTitle === 'string' && mediaTitle.trim() !== '') {
          title = mediaTitle.trim();
        }
      } else if (titleField && content?.fields?.[titleField]) {
        title = content.fields[titleField];
      }
      if (content?.sys?.status) {
        status = content.sys.status;
      }
    } catch (_e) {
      // Fall back to id as title
    }

    if (!isProductionMode()) {
      try {
        const stat = await fsPromises.stat(path.join(process.cwd(), file));
        updatedAt = stat.mtime.toISOString();
      } catch {
        // ignore
      }
    }

    entries.push({ type, id, path: file, title, status, updatedAt });
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
    // Skip media entries
    if (file.includes('/media/')) continue;

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
