'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { glob } from 'glob';
import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';
import { getAgentConfig } from '../../agent/configStore';
import { syncEmbeddingsAfterRemove, syncEmbeddingsAfterUpsert } from '../../agent/embeddingsHook';
import { BRANCH_HISTORY_FILE_PATH, mergeHistoryContentWithAppendedEntry } from '../../lib/branchHistory';
import { getPostBlogPublicPath } from '../../lib/blogPublicPath';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { initialFieldsForNewEntry } from '../../lib/initialEntryFields';
import { persistedFieldsFromFormStrings } from '../../lib/persistedFormFields';
import { normalizeStoredSlug } from '../../lib/slugField';
import { validateEntryFields } from '../../lib/validateEntryFields';
import type { Config } from '../types';

import {
  deleteGitHubFile,
  getGitHubFile,
  isProductionMode,
  listGitHubFiles,
  listGitHubFilesRecursive,
  readGitHubFilePublic,
  saveGitHubFile,
} from '../github';
import { applyMutation, getStoredContentFiles, getStoredFile, getStoredFileSha } from '../store/contentStore';
import { mediaContentFolder, mediaEntryPath } from '../../lib/mediaPath';
import { buildJsons } from './build';
import {
  actionErr,
  actionOk,
  getErrorMessage,
  type ActionResult,
  type NewFileResult,
  type SaveFileResult,
} from './utils';

export type { SaveFileResult } from './utils';

const CMS_ACTIVE_BRANCH_COOKIE = 'cms-active-branch';

function normalizeContentPath(p: string): string {
  return p.replace(/\\/g, '/');
}

/** Best-effort embedding store sync after content writes. No-op when the agent isn't configured. */
async function syncEmbeddingsForUpsertIfEnabled(
  entryPath: string,
  payload: { sys?: { type?: string }; fields?: Record<string, unknown> },
  companions: Record<string, string>,
  branch: string | undefined,
  isProduction: boolean,
): Promise<void> {
  const agentConfig = getAgentConfig();
  if (!agentConfig) return;
  const config = getConfig();
  await syncEmbeddingsAfterUpsert({ agentConfig, config, entryPath, payload, companions, branch, isProduction });
}

async function syncEmbeddingsForRemoveIfEnabled(
  entryPath: string,
  branch: string | undefined,
  isProduction: boolean,
): Promise<void> {
  const agentConfig = getAgentConfig();
  if (!agentConfig) return;
  await syncEmbeddingsAfterRemove({ agentConfig, entryPath, branch, isProduction });
}

/** Records the entry path under the active branch in `cms/branch-history.json` (GitHub or local). Best-effort. */
async function persistBranchHistoryEntryIfNeeded(activeBranch: string | undefined, entryPath: string): Promise<void> {
  if (!activeBranch) {
    return;
  }

  const normalized = normalizeContentPath(entryPath);

  if (isProductionMode()) {
    try {
      const historyFile = await getGitHubFile(BRANCH_HISTORY_FILE_PATH, activeBranch);
      const next = mergeHistoryContentWithAppendedEntry(historyFile?.content ?? '', activeBranch, normalized);
      if (next == null) {
        return;
      }

      await saveGitHubFile(BRANCH_HISTORY_FILE_PATH, next, 'CMS: track entry in branch history', activeBranch);
    } catch {
      /* best-effort sidecar — primary save must still succeed */
    }

    return;
  }

  try {
    const abs = path.join(/*turbopackIgnore: true*/ process.cwd(), BRANCH_HISTORY_FILE_PATH);
    let raw = '';
    try {
      raw = await fsPromises.readFile(abs, { encoding: 'utf8' });
    } catch {
      raw = '';
    }

    const next = mergeHistoryContentWithAppendedEntry(raw, activeBranch, normalized);
    if (next == null) {
      return;
    }

    await fsPromises.mkdir(path.dirname(abs), { recursive: true });
    await fsPromises.writeFile(abs, next, 'utf8');
  } catch {
    /* best-effort sidecar */
  }
}

async function assertSlugFieldsUnique(
  entryType: string,
  fileName: string,
  persistedFields: Record<string, unknown>,
): Promise<{ ok: true } | { ok: false; fieldKey: string; message: string }> {
  const config = getConfig();
  const col = config.collections[entryType as keyof Config['collections']];
  if (!col) {
    return { ok: true };
  }

  const slugFieldEntries = Object.entries(col.fields).filter(([, def]) => def.format === 'slug');
  if (slugFieldEntries.length === 0) {
    return { ok: true };
  }

  const selfPath = normalizeContentPath(fileName);
  const siblings = await getContentFiles(entryType);

  for (const [slugKey] of slugFieldEntries) {
    const candidate = persistedFields[slugKey];
    if (typeof candidate !== 'string' || !candidate.trim()) {
      continue;
    }
    const normCandidate = normalizeStoredSlug(candidate);
    if (!normCandidate) {
      continue;
    }

    for (const siblingPath of siblings) {
      if (normalizeContentPath(siblingPath) === selfPath) {
        continue;
      }
      let data: unknown;
      try {
        data = await getFile(siblingPath);
      } catch {
        continue;
      }
      if (!data || typeof data !== 'object') {
        continue;
      }
      const fields = (data as { fields?: Record<string, unknown> }).fields;
      if (!fields) {
        continue;
      }
      const other = fields[slugKey];
      if (typeof other !== 'string' || !other.trim()) {
        continue;
      }
      if (normalizeStoredSlug(other) === normCandidate) {
        return {
          ok: false,
          fieldKey: slugKey,
          message: `Another ${col.label} already uses this slug. Choose a different value.`,
        };
      }
    }
  }

  return { ok: true };
}

const MEDIA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function assertImageFieldsReferenceMediaWithTitle(
  entryType: string,
  strFields: Record<string, string>,
): Promise<{ ok: true } | { ok: false; fieldKey: string; message: string }> {
  const config = getConfig();
  const col = config.collections[entryType as keyof Config['collections']];
  if (!col) {
    return { ok: true };
  }

  for (const [key, def] of Object.entries(col.fields)) {
    if (def.format !== 'image') {
      continue;
    }
    const raw = (strFields[key] ?? '').trim();
    if (!raw || raw.startsWith('/')) {
      continue;
    }
    if (!MEDIA_UUID_RE.test(raw)) {
      continue;
    }

    const mediaPath = mediaEntryPath(raw);
    let media: unknown;
    try {
      media = await getFile(mediaPath);
    } catch {
      return {
        ok: false,
        fieldKey: key,
        message: `Media not found for ${def.label}. Choose a valid image in the Media library.`,
      };
    }

    const title = (media as { fields?: { title?: unknown } })?.fields?.title;
    if (typeof title !== 'string' || !title.trim()) {
      return {
        ok: false,
        fieldKey: key,
        message: `Selected image is missing a required Title; fix it in the Media library.`,
      };
    }
  }

  return { ok: true };
}

/**
 * In production, reject writes that would target `config.git.baseBranch` (no feature branch cookie).
 */
export const assertFeatureBranchForWritesIfRequired = async (): Promise<void> => {
  if (!isProductionMode()) {
    return;
  }

  if (!(await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value) {
    throw new Error('Create or select a branch before editing.');
  }
};

export const waitForPublicReadConsistency = async (fileName: string, expectedContent: string, readRef?: string) => {
  if (!isProductionMode()) {
    return;
  }

  const parsedAttempts = Number.parseInt(process.env.CMS_GITHUB_CONSISTENCY_ATTEMPTS || '8', 10);
  const parsedDelayMs = Number.parseInt(process.env.CMS_GITHUB_CONSISTENCY_DELAY_MS || '250', 10);
  const maxAttempts = Number.isFinite(parsedAttempts) && parsedAttempts > 0 ? parsedAttempts : 1;
  const delayMs = Number.isFinite(parsedDelayMs) && parsedDelayMs >= 0 ? parsedDelayMs : 250;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const visibleContent = await readGitHubFilePublic(fileName, readRef);

      if (visibleContent === expectedContent) {
        return;
      }
    } catch (_e) {
      // Ignore transient read failures and retry within the same save request.
    }

    if (attempt < maxAttempts && delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export const getContentFiles = async (collection: string = '**') => {
  const config = getConfig();
  try {
    if (isProductionMode()) {
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;

      // Try in-memory store first (instant)
      try {
        const stored = await getStoredContentFiles(collection, activeBranch);
        if (stored) return stored;
      } catch {
        // Store unavailable — fall through to direct GitHub API
      }

      try {
        if (collection === '**') {
          return await listGitHubFilesRecursive(config.contentFolder, '.json', activeBranch);
        }

        return await listGitHubFiles(`${config.contentFolder}/${collection}`, '.json', activeBranch);
      } catch (e) {
        // Fall back to local files if GitHub API access is not available.
      }
    }

    const files = await glob(`${config.contentFolder}/${collection}/*.json`);
    return files || [];
  } catch (e) {
    return [];
  }
};

/**
 * List media-entry JSON files (e.g. `cms/media/media-<uuid>.json`).
 *
 * Distinct from `getContentFiles`, which lists editorial content under
 * `config.contentFolder`, and from `getMediaFiles`, which lists physical image
 * binaries under `config.mediaFolder`. This is the JSON-entry layer.
 */
export const getMediaContentFiles = async (): Promise<string[]> => {
  const folder = mediaContentFolder();
  try {
    if (isProductionMode()) {
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;

      try {
        return await listGitHubFiles(folder, '.json', activeBranch);
      } catch (_e) {
        // Fall back to local files if GitHub API access is not available.
      }
    }

    const files = await glob(`${folder}/*.json`);
    return files || [];
  } catch (_e) {
    return [];
  }
};

export const getMediaFiles = async (folder: string = '**') => {
  const config = getConfig();
  try {
    if (isProductionMode()) {
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;

      try {
        const dir = folder === '**' ? config.mediaFolder : `${config.mediaFolder}/${folder}`;
        const allFiles = await listGitHubFilesRecursive(dir, undefined, activeBranch);
        const extensions = config.mediaAllowedFormats;
        return allFiles.filter((f) => extensions.some((ext) => f.endsWith(`.${ext}`)));
      } catch (e) {
        // Fall back to local files if GitHub API access is not available.
      }
    }

    const files = await glob(`${config.mediaFolder}/${folder}/*.{${config.mediaAllowedFormats.join(',')}}`);
    return files || [];
  } catch (e) {
    return [];
  }
};

export const getFile = async (fileName: string) => {
  const config = getConfig();
  try {
    let entry: any;

    if (isProductionMode()) {
      // Try in-memory store first (instant, includes pre-merged companions)
      try {
        const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
        const stored = await getStoredFile(fileName, activeBranch);

        if (stored) {
          entry = structuredClone(stored.content);
          // Merge pre-cached companion markdown into fields
          if (entry.fields) {
            for (const [fieldName, mdContent] of Object.entries(stored.companionMarkdown)) {
              entry.fields[fieldName] = mdContent;
            }
          }
          return entry;
        }
      } catch {
        // Store unavailable — fall through to direct GitHub API
      }

      try {
        const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
        const result = await getGitHubFile(fileName, activeBranch);

        if (result) {
          entry = JSON.parse(result.content);
        }
      } catch (e) {
        // Fall back to local file if GitHub API access is not available.
      }
    }

    if (!entry) {
      const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);
      const data = await fsPromises.readFile(filePath, { encoding: 'utf8' });
      entry = JSON.parse(data);
    }

    if (!entry) {
      return {};
    }

    // Merge companion markdown and richtext files into fields
    const collectionType = entry?.sys?.type;
    if (typeof collectionType === 'string' && entry.fields) {
      const companionPaths = companionMarkdownPathsForEntry(fileName, collectionType, config.collections);
      for (const [fieldName, mdPath] of Object.entries(companionPaths)) {
        entry.fields[fieldName] = await readCompanionMarkdownContent(mdPath);
      }
      const richTextPaths = companionRichTextPathsForEntry(fileName, collectionType, config.collections);
      for (const [fieldName, mdxPath] of Object.entries(richTextPaths)) {
        entry.fields[fieldName] = await readCompanionMarkdownContent(mdxPath);
      }
    }

    return entry;
  } catch (e) {
    throw new Error('Failed to get file');
  }
};

/** Read a companion markdown file as a string. Returns `""` if the file does not exist. */
async function readCompanionMarkdownContent(filePath: string): Promise<string> {
  if (isProductionMode()) {
    try {
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
      const result = await getGitHubFile(filePath, activeBranch);
      return result?.content ?? '';
    } catch {
      return '';
    }
  }

  try {
    return await fsPromises.readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), filePath), {
      encoding: 'utf8',
    });
  } catch {
    return '';
  }
}

export const saveFile = async (
  formData: any,
  fileName: string,
  options?: { skipStatusTransition?: boolean },
): Promise<SaveFileResult> => {
  const config = getConfig();
  try {
    let payload = formData;
    const entryType = payload?.sys?.type;
    const rawFields = payload?.fields;
    let previousBlogPaths: string[] = [];
    if (typeof entryType === 'string' && rawFields && typeof rawFields === 'object' && !Array.isArray(rawFields)) {
      try {
        const existing = await getFile(fileName);
        const prevPath = getPostBlogPublicPath(existing);
        if (prevPath) {
          previousBlogPaths.push(prevPath);
        }
      } catch {
        /* new file path or read failure — ignore */
      }

      const strFields: Record<string, string> = {};
      for (const [k, v] of Object.entries(rawFields)) {
        if (v == null) {
          strFields[k] = '';
        } else if (typeof v === 'object') {
          strFields[k] = JSON.stringify(v);
        } else {
          strFields[k] = String(v);
        }
      }
      const validated = validateEntryFields(entryType, strFields);
      if (!validated.ok) {
        const first = Object.values(validated.fieldErrors)[0];
        return {
          success: false,
          error: first || 'Validation failed',
          fieldErrors: validated.fieldErrors,
        };
      }

      const mediaTitles = await assertImageFieldsReferenceMediaWithTitle(entryType, strFields);
      if (!mediaTitles.ok) {
        return {
          success: false,
          error: mediaTitles.message,
          fieldErrors: { [mediaTitles.fieldKey]: mediaTitles.message },
        };
      }

      payload = {
        ...payload,
        fields: persistedFieldsFromFormStrings(entryType, strFields),
      };

      const slugUnique = await assertSlugFieldsUnique(entryType, fileName, payload.fields);
      if (!slugUnique.ok) {
        return {
          success: false,
          error: slugUnique.message,
          fieldErrors: { [slugUnique.fieldKey]: slugUnique.message },
        };
      }
    }

    // Auto-transition published/merged → changed on regular save (not on explicit publish)
    if (!options?.skipStatusTransition && (payload?.sys?.status === 'published' || payload?.sys?.status === 'merged')) {
      payload = { ...payload, sys: { ...payload.sys, status: 'changed' } };
    }

    // Extract markdown and richtext fields into companion files, remove from JSON payload
    const markdownContents: Record<string, string> = {};
    if (typeof entryType === 'string' && payload.fields) {
      const companionPaths = companionMarkdownPathsForEntry(fileName, entryType, config.collections);
      for (const [fieldName] of Object.entries(companionPaths)) {
        markdownContents[fieldName] = payload.fields[fieldName] ?? '';
        delete payload.fields[fieldName];
      }
      const richTextPaths = companionRichTextPathsForEntry(fileName, entryType, config.collections);
      for (const [fieldName] of Object.entries(richTextPaths)) {
        markdownContents[fieldName] = payload.fields[fieldName] ?? '';
        delete payload.fields[fieldName];
      }
    }

    const data = JSON.stringify(payload, null, 2);
    const normalizedData = `${data}\n`;

    const nextBlogPath = getPostBlogPublicPath(payload);
    const blogPaths = [...previousBlogPaths, ...(nextBlogPath ? [nextBlogPath] : [])];

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const entryTypeLabel = payload?.sys?.type || 'content';
      const entryId = payload?.sys?.id || '';
      const message = `Update ${entryTypeLabel} ${entryId}`;
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;

      // Use cached SHA from the store to skip the pre-read API call
      const cachedSha = (await getStoredFileSha(fileName, activeBranch)) || undefined;
      await saveGitHubFile(fileName, normalizedData, message, activeBranch, cachedSha);
      // Write companion markdown and richtext files
      const mdPaths =
        typeof entryType === 'string' ? companionMarkdownPathsForEntry(fileName, entryType, config.collections) : {};
      for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
        const mdContent = markdownContents[fieldName] ?? '';
        await saveGitHubFile(mdPath, mdContent, `Update ${fieldName} for ${entryType} ${entryId}`, activeBranch);
      }
      const rtPaths =
        typeof entryType === 'string' ? companionRichTextPathsForEntry(fileName, entryType, config.collections) : {};
      for (const [fieldName, rtPath] of Object.entries(rtPaths)) {
        const rtContent = markdownContents[fieldName] ?? '';
        await saveGitHubFile(rtPath, rtContent, `Update ${fieldName} for ${entryType} ${entryId}`, activeBranch);
      }
      await waitForPublicReadConsistency(fileName, normalizedData);

      // Write-through: update in-memory store so subsequent reads are instant
      if (activeBranch) {
        applyMutation(activeBranch, {
          type: 'upsert',
          path: fileName,
          content: payload,
          sha: '', // SHA unknown after single-file commit; next tree fetch will correct it
          companions: markdownContents,
        });
      }

      await persistBranchHistoryEntryIfNeeded(activeBranch, fileName);
      await syncEmbeddingsForUpsertIfEnabled(fileName, payload, markdownContents, activeBranch, true);
      const built = await buildJsons(fileName, { blogPaths });

      return built.success ? actionOk() : built;
    }

    const cookieStore = await cookies();
    const activeBranchDev = cookieStore.get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);
    await fsPromises.writeFile(filePath, normalizedData, 'utf8');
    // Write companion markdown and richtext files
    const mdPaths =
      typeof entryType === 'string' ? companionMarkdownPathsForEntry(fileName, entryType, config.collections) : {};
    for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
      const mdContent = markdownContents[fieldName] ?? '';
      await fsPromises.writeFile(path.join(/*turbopackIgnore: true*/ process.cwd(), mdPath), mdContent, 'utf8');
    }
    const rtPathsDev =
      typeof entryType === 'string' ? companionRichTextPathsForEntry(fileName, entryType, config.collections) : {};
    for (const [fieldName, rtPath] of Object.entries(rtPathsDev)) {
      const rtContent = markdownContents[fieldName] ?? '';
      await fsPromises.writeFile(path.join(/*turbopackIgnore: true*/ process.cwd(), rtPath), rtContent, 'utf8');
    }
    await persistBranchHistoryEntryIfNeeded(activeBranchDev, fileName);
    await syncEmbeddingsForUpsertIfEnabled(fileName, payload, markdownContents, activeBranchDev, false);
    const built = await buildJsons(fileName, { blogPaths });

    return built.success ? actionOk() : built;
  } catch (e) {
    return actionErr(new Error(`Failed to save file: ${getErrorMessage(e)}`));
  }
};

export const newFile = async (type: string): Promise<NewFileResult> => {
  const config = getConfig();
  try {
    const id = crypto.randomUUID();
    const values = {
      sys: {
        id,
        type,
        status: 'draft' as const,
      },
      fields: initialFieldsForNewEntry(type),
    };
    const data = JSON.stringify(values, null, 2);
    const file = `${config.contentFolder}/${type}/${type}-${id}.json`;
    const normalizedData = `${data}\n`;

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
      await saveGitHubFile(file, normalizedData, `Create new ${type} ${id}`, activeBranch);
      await waitForPublicReadConsistency(file, normalizedData);

      // Write-through: add new entry to in-memory store
      if (activeBranch) {
        applyMutation(activeBranch, {
          type: 'upsert',
          path: file,
          content: values,
          sha: '',
        });
      }

      await persistBranchHistoryEntryIfNeeded(activeBranch, file);
      await syncEmbeddingsForUpsertIfEnabled(file, values, {}, activeBranch, true);
      const built = await buildJsons(file);

      return built.success ? { success: true, path: file } : { success: false, error: built.error };
    }

    const cookieStore = await cookies();
    const activeBranchDev = cookieStore.get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), file);
    await fsPromises.writeFile(filePath, normalizedData, 'utf8');
    await persistBranchHistoryEntryIfNeeded(activeBranchDev, file);
    await syncEmbeddingsForUpsertIfEnabled(file, values, {}, activeBranchDev, false);
    const built = await buildJsons(file);

    return built.success ? { success: true, path: file } : { success: false, error: built.error };
  } catch (e) {
    return { success: false, error: getErrorMessage(e) } satisfies NewFileResult;
  }
};

export const removeFile = async (fileName: string): Promise<ActionResult> => {
  const config = getConfig();
  try {
    let blogPaths: string[] = [];
    let collectionType: string | undefined;
    try {
      const existing = await getFile(fileName);
      collectionType = existing?.sys?.type;
      const p = getPostBlogPublicPath(existing);
      if (p) {
        blogPaths.push(p);
      }
    } catch {
      /* best-effort */
    }

    // Determine companion markdown and richtext files to delete
    const companionPaths =
      typeof collectionType === 'string'
        ? [
            ...Object.values(companionMarkdownPathsForEntry(fileName, collectionType, config.collections)),
            ...Object.values(companionRichTextPathsForEntry(fileName, collectionType, config.collections)),
          ]
        : [];

    if (isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
      await deleteGitHubFile(fileName, `Remove ${fileName}`, activeBranch);
      for (const mdPath of companionPaths) {
        try {
          await deleteGitHubFile(mdPath, `Remove companion ${mdPath}`, activeBranch);
        } catch {
          /* best-effort — companion may not exist */
        }
      }

      // Write-through: remove entry from in-memory store
      if (activeBranch) {
        applyMutation(activeBranch, { type: 'delete', path: fileName });
      }

      await syncEmbeddingsForRemoveIfEnabled(fileName, activeBranch, true);
      const built = await buildJsons(fileName, { blogPaths });

      return built.success ? actionOk() : built;
    }

    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), fileName);
    await fsPromises.unlink(filePath);
    for (const mdPath of companionPaths) {
      try {
        await fsPromises.unlink(path.join(/*turbopackIgnore: true*/ process.cwd(), mdPath));
      } catch {
        /* best-effort — companion may not exist */
      }
    }
    await syncEmbeddingsForRemoveIfEnabled(fileName, undefined, false);
    const built = await buildJsons(fileName, { blogPaths });

    return built.success ? actionOk() : built;
  } catch (e) {
    return actionErr(e);
  }
};
