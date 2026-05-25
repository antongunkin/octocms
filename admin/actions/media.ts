'use server';

import './registerConfig';

import fsPromises from 'fs/promises';
import path from 'path';

import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';
import type { Config } from '../types';
import { extractImageMetadata } from '../../lib/extractImageMetadata';
import type { MediaFile } from '../../types';

import { mediaContentFolder, mediaEntryPath } from '../../lib/mediaPath';
import { getAgentConfig } from '../../agent/configStore';
import { syncEmbeddingsAfterRemove, syncEmbeddingsAfterUpsert } from '../../agent/embeddingsHook';

import { deleteGitHubFile, isProductionMode, saveGitHubBinaryFile, saveGitHubFile } from '../github';
import { applyMutation, getStoredMediaEntries } from '../store/contentStore';
import { assertFeatureBranchForWritesIfRequired, getContentFiles, getFile, getMediaContentFiles } from './files';
import { actionErr, actionOk, getErrorMessage, type ActionResult, type UploadMediaResult } from './utils';

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB

/** Best-effort embedding sync after a media write — same shape as the hook used by content writes. */
async function syncMediaEmbeddingUpsert(
  entryPath: string,
  payload: { sys?: { type?: string }; fields?: Record<string, unknown> },
): Promise<void> {
  const agentConfig = getAgentConfig();
  if (!agentConfig) return;
  const cfg = getConfig();
  const activeBranch = isProductionMode() ? (await cookies()).get('cms-active-branch')?.value : undefined;
  await syncEmbeddingsAfterUpsert({
    agentConfig,
    config: cfg,
    entryPath,
    payload,
    companions: {},
    branch: activeBranch,
    isProduction: isProductionMode(),
  });
}

async function syncMediaEmbeddingRemove(entryPath: string): Promise<void> {
  const agentConfig = getAgentConfig();
  if (!agentConfig) return;
  const activeBranch = isProductionMode() ? (await cookies()).get('cms-active-branch')?.value : undefined;
  await syncEmbeddingsAfterRemove({
    agentConfig,
    entryPath,
    branch: activeBranch,
    isProduction: isProductionMode(),
  });
}

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
  const blurDataURL = typeof blur === 'string' && blur.length > 0 ? blur : null;
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
    blurDataURL,
  };
}

/**
 * Get all media entries from the configured media-content folder
 * (`config.mediaContentFolder`, default `cms/media/`).
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

  const files = await getMediaContentFiles();
  const entries: MediaFile[] = [];

  for (const file of files) {
    try {
      const content = await getFile(file);
      const mf = contentToMediaFile(content);
      if (!mf) continue;
      // Stamp the dev-mode mtime so the list can sort by "newest first".
      // Production reads from GitHub which doesn't expose stat — `updatedAt`
      // stays undefined and the list falls back to insertion order. The
      // The `process.env.NODE_ENV !== 'production'` guard is replaced with a
      // string literal at build time, so this block is dead code in production
      // bundles. The bundler DCEs it, removing the path.join(process.cwd(), …)
      // call that would otherwise trip NFT into over-tracing.
      if (process.env.NODE_ENV !== 'production') {
        try {
          const stat = await fsPromises.stat(path.join(process.cwd(), file));
          mf.updatedAt = stat.mtime.toISOString();
        } catch {
          // ignore — stat unavailable, sort will treat as oldest
        }
      }
      entries.push(mf);
    } catch (_e) {
      // Skip invalid entries
    }
  }

  // Default sort: newest first. Entries without `updatedAt` (e.g. production
  // reads) sort to the end so dev mode and prod stay visually consistent.
  entries.sort((a, b) => {
    if (!a.updatedAt && !b.updatedAt) return 0;
    if (!a.updatedAt) return 1;
    if (!b.updatedAt) return -1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return entries;
};

/**
 * Upload a media file. Creates a physical file at `<mediaFolder>/[uuid].[ext]`
 * and a media entry at `<mediaContentFolder>/media-[uuid].json`.
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
  const entryPath = mediaEntryPath(id);

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const generateBlurRaw = formData.get('generateBlur');
    // Default ON — only the explicit string '0' or 'false' opts out.
    const generateBlur = !(generateBlurRaw === '0' || generateBlurRaw === 'false');
    const { width, height, blurDataURL } = await extractImageMetadata(buffer, { generateBlur });

    const fields: Record<string, unknown> = {
      title,
      // Stored filename = the actual on-disk filename (UUID-based), not the
      // user's upload name. Avoids leaking messy filenames like
      // "Long file name.jpg" into the UI; the physical file already lives at
      // `<mediaFolder>/<uuid>.<ext>` so this stays consistent.
      originalName: `${id}.${ext}`,
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

    if (process.env.NODE_ENV === 'production' || isProductionMode()) {
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

      await fsPromises.mkdir(path.join(process.cwd(), mediaContentFolder()), { recursive: true });
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), `${JSON.stringify(entry, null, 2)}\n`, 'utf8');
    }

    // Best-effort: index the new media entry so it appears in chat-agent search.
    await syncMediaEmbeddingUpsert(entryPath, entry);

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

  const entryPath = mediaEntryPath(mediaId);
  let entry;

  try {
    entry = await getFile(entryPath);
  } catch (_e) {
    return { success: false, error: 'Media entry not found' };
  }

  const ext = entry?.fields?.extension || '';
  const physicalPath = `${config.mediaFolder}/${mediaId}.${ext}`;

  try {
    if (process.env.NODE_ENV === 'production' || isProductionMode()) {
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

    // Drop from the chat-agent search index.
    await syncMediaEmbeddingRemove(entryPath);

    return actionOk();
  } catch (e) {
    return actionErr(new Error(`Failed to delete media: ${getErrorMessage(e)}`));
  }
};

/**
 * Move a media entry to a different virtual folder.
 */
export const moveMedia = async (mediaId: string, newFolder: string): Promise<ActionResult> => {
  const entryPath = mediaEntryPath(mediaId);

  try {
    const entry = await getFile(entryPath);
    entry.fields.folder = newFolder || '/';

    const data = `${JSON.stringify(entry, null, 2)}\n`;

    if (process.env.NODE_ENV === 'production' || isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await saveGitHubFile(entryPath, data, `Move media ${mediaId} to ${newFolder}`, activeBranch);

      if (activeBranch) {
        applyMutation(activeBranch, { type: 'upsert', path: entryPath, content: entry, sha: '' });
      }
    } else {
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), data, 'utf8');
    }

    await syncMediaEmbeddingUpsert(entryPath, entry);

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

  const entryPath = mediaEntryPath(mediaId);

  try {
    const entry = await getFile(entryPath);
    if (!entry?.fields || typeof entry.fields !== 'object') {
      return { success: false, error: 'Media entry not found' };
    }
    entry.fields.title = trimmed;

    const data = `${JSON.stringify(entry, null, 2)}\n`;

    if (process.env.NODE_ENV === 'production' || isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get('cms-active-branch')?.value;
      await saveGitHubFile(entryPath, data, `Update media title ${mediaId}`, activeBranch);

      if (activeBranch) {
        applyMutation(activeBranch, { type: 'upsert', path: entryPath, content: entry, sha: '' });
      }
    } else {
      await fsPromises.writeFile(path.join(process.cwd(), entryPath), data, 'utf8');
    }

    await syncMediaEmbeddingUpsert(entryPath, entry);

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
