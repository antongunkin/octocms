'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';
import { extractImageMetadata } from '../../lib/extractImageMetadata';
import type { MediaFile } from '../../types';

import { deleteGitHubFile, isProductionMode, saveGitHubBinaryFile, saveGitHubFile } from '../github';
import { applyMutation, getStoredMediaEntries } from '../store/contentStore';
import { assertFeatureBranchForWritesIfRequired, getContentFiles, getFile } from './files';
import { actionErr, actionOk, getErrorMessage, type ActionResult, type UploadMediaResult } from './utils';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

/** Convert parsed entry content to a MediaFile object. Returns null if the entry is invalid. */
function contentToMediaFile(content: Record<string, unknown>): MediaFile | null {
  const config = getConfig();
  const sys = content.sys as { id?: string } | undefined;
  const fields = content.fields as Record<string, unknown> | undefined;
  if (!sys?.id || !fields) return null;

  const id = sys.id;
  const ext = (typeof fields.extension === 'string' ? fields.extension : '') || '';
  const title = typeof fields.title === 'string' ? fields.title : '';
  const width = typeof fields.width === 'number' && fields.width > 0 ? fields.width : null;
  const height = typeof fields.height === 'number' && fields.height > 0 ? fields.height : null;
  const blur = fields.blurDataURL;
  const hasBlurPlaceholder = typeof blur === 'string' && blur.length > 0;

  return {
    id,
    title,
    originalName: (typeof fields.originalName === 'string' ? fields.originalName : '') || '',
    extension: ext,
    folder: (typeof fields.folder === 'string' ? fields.folder : '') || '/',
    path: `${config.mediaFolder}/${id}.${ext}`,
    publicUrl: `/media/${id}.${ext}`,
    width,
    height,
    hasBlurPlaceholder,
  };
}

/**
 * Get all media entries from cms/content/media/.
 */
export const getMediaEntries = async (): Promise<MediaFile[]> => {
  // Try in-memory store first (instant, all media entries pre-indexed)
  if (isProductionMode()) {
    try {
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      const storedMedia = await getStoredMediaEntries(activeBranch);

      if (storedMedia) {
        const entries: MediaFile[] = [];
        for (const [, stored] of storedMedia) {
          const mf = contentToMediaFile(stored.content);
          if (mf) entries.push(mf);
        }
        return entries;
      }
    } catch {
      // Store unavailable — fall through to per-file reads
    }
  }

  const files = await getContentFiles('media');
  const entries: MediaFile[] = [];

  for (const file of files) {
    try {
      const content = await getFile(file);
      const mf = contentToMediaFile(content);
      if (mf) entries.push(mf);
    } catch (_e) {
      // Skip invalid entries
    }
  }

  return entries;
};

/**
 * Upload a media file. Creates a physical file at public/media/[uuid].[ext]
 * and a media entry at cms/content/media/media-[uuid].json.
 *
 * @returns The media entry UUID
 */
export const uploadMedia = async (formData: FormData): Promise<UploadMediaResult> => {
  const config = getConfig();
  const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string | null) || '/';
  const titleRaw = formData.get('title');
  const title = typeof titleRaw === 'string' ? titleRaw.trim() : '';

  if (!title) {
    return { success: false, error: 'Title is required for every uploaded image' };
  }

  if (!file || !(file instanceof File)) {
    return { success: false, error: 'No file provided' };
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    return {
      success: false,
      error: `File too large. Maximum size is ${MAX_UPLOAD_SIZE / 1024 / 1024} MB`,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';

  if (!config.mediaAllowedFormats.includes(ext)) {
    return {
      success: false,
      error: `File format ".${ext}" is not allowed. Allowed: ${config.mediaAllowedFormats.join(', ')}`,
    };
  }

  const id = crypto.randomUUID();
  const physicalPath = `${config.mediaFolder}/${id}.${ext}`;
  const entryPath = `${`${getConfig().contentFolder}/media`}/media-${id}.json`;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { width, height, blurDataURL } = await extractImageMetadata(buffer);

    const fields: Record<string, unknown> = {
      title,
      originalName: file.name,
      extension: ext,
      folder,
    };
    if (width != null) fields.width = width;
    if (height != null) fields.height = height;
    if (blurDataURL != null) fields.blurDataURL = blurDataURL;

    const entry = {
      sys: { id, type: 'media' },
      fields,
    };

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await saveGitHubBinaryFile(physicalPath, buffer, `Upload media ${file.name}`, activeBranch);
      await saveGitHubFile(entryPath, `${JSON.stringify(entry, null, 2)}\n`, `Add media entry ${id}`, activeBranch);

      // Write-through: add media entry to in-memory store
      if (activeBranch) {
        applyMutation(activeBranch, { type: 'upsert', path: entryPath, content: entry, sha: '' });
      }
    } else {
      await fsPromises.mkdir(path.join(process.cwd(), config.mediaFolder), { recursive: true });
      await fsPromises.writeFile(path.join(process.cwd(), physicalPath), buffer);

      await fsPromises.mkdir(path.join(process.cwd(), `${getConfig().contentFolder}/media`), { recursive: true });
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    }

    return { success: true, id };
  } catch (e) {
    return { success: false, error: `Failed to upload file: ${getErrorMessage(e)}` };
  }
};

/**
 * Delete a media entry and its physical file.
 * Blocks deletion if the image is referenced by any content entry.
 */
export const deleteMedia = async (mediaId: string): Promise<ActionResult> => {
  const config = getConfig();
  const refs = await checkMediaReferences(mediaId);

  if (refs.length > 0) {
    return {
      success: false,
      error: `Cannot delete: image is used in ${refs.length} content entry(ies)`,
    };
  }

  const entryPath = `${`${getConfig().contentFolder}/media`}/media-${mediaId}.json`;
  let entry;

  try {
    entry = await getFile(entryPath);
  } catch (_e) {
    return { success: false, error: 'Media entry not found' };
  }

  const ext = entry?.fields?.extension || '';
  const physicalPath = `${config.mediaFolder}/${mediaId}.${ext}`;

  try {
    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await deleteGitHubFile(physicalPath, `Delete media file ${mediaId}`, activeBranch);
      await deleteGitHubFile(entryPath, `Delete media entry ${mediaId}`, activeBranch);

      // Write-through: remove media entry from in-memory store
      if (activeBranch) {
        applyMutation(activeBranch, { type: 'delete', path: entryPath });
      }
    } else {
      await fsPromises.unlink(path.join(process.cwd(), physicalPath));
      await fsPromises.unlink(path.join(process.cwd(), entryPath));
    }

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed to delete media: ${getErrorMessage(e)}`));
  }
};

/**
 * Move a media entry to a different virtual folder.
 */
export const moveMedia = async (mediaId: string, newFolder: string): Promise<ActionResult> => {
  const entryPath = `${`${getConfig().contentFolder}/media`}/media-${mediaId}.json`;

  try {
    const entry = await getFile(entryPath);
    entry.fields.folder = newFolder || '/';

    const data = `${JSON.stringify(entry, null, 2)}\n`;

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await saveGitHubFile(entryPath, data, `Move media ${mediaId} to ${newFolder}`, activeBranch);

      if (activeBranch) {
        applyMutation(activeBranch, { type: 'upsert', path: entryPath, content: entry, sha: '' });
      }
    } else {
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), data, 'utf8');
    }

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed to move media: ${getErrorMessage(e)}`));
  }
};

/**
 * Update human-readable title on a media entry (required for accessibility / alt text).
 */
export const updateMediaMetadata = async (mediaId: string, title: string): Promise<ActionResult> => {
  const trimmed = title.trim();
  if (!trimmed) {
    return { success: false, error: 'Title is required' };
  }

  const entryPath = `${`${getConfig().contentFolder}/media`}/media-${mediaId}.json`;

  try {
    const entry = await getFile(entryPath);
    if (!entry?.fields || typeof entry.fields !== 'object') {
      return { success: false, error: 'Media entry not found' };
    }
    entry.fields.title = trimmed;

    const data = `${JSON.stringify(entry, null, 2)}\n`;

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await saveGitHubFile(entryPath, data, `Update media title ${mediaId}`, activeBranch);

      if (activeBranch) {
        applyMutation(activeBranch, { type: 'upsert', path: entryPath, content: entry, sha: '' });
      }
    } else {
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), data, 'utf8');
    }

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed to update media: ${getErrorMessage(e)}`));
  }
};

/**
 * Check all content entries for image fields referencing this media ID.
 * Returns an array of file paths that reference the given media ID.
 */
export const checkMediaReferences = async (mediaId: string): Promise<string[]> => {
  const config = getConfig();
  const allFiles = await getContentFiles('**');
  const references: string[] = [];

  for (const file of allFiles) {
    if (file.includes('/media/')) continue;

    try {
      const content = await getFile(file);
      const type = content?.sys?.type;

      if (!type) continue;

      const collection = config.collections[type as keyof Config['collections']];

      if (!collection) continue;

      const imageFieldKeys = Object.keys(collection.fields).filter((k) => collection.fields[k].format === 'image');

      for (const field of imageFieldKeys) {
        if (content?.fields?.[field] === mediaId) {
          references.push(file);
          break;
        }
      }
    } catch (_e) {
      // Skip files that can't be read
    }
  }

  return references;
};
