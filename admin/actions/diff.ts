'use server';

import './registerConfig';

import { execFile } from 'node:child_process';
import fsPromises from 'node:fs/promises';

import { getConfig } from '../../lib/configStore';
import { companionFilePathsForEntry } from '../../lib/companionMarkdown';
import { diffEntryFields, safeParseEntry, type FieldDiff } from '../../lib/entryDiff';
import { logCmsServerError } from '../../lib/cmsServerLog';
import { mediaContentFolder, mediaEntryPath } from '../../lib/mediaPath';
import { parseFileName } from '../../utils/parseFileName';
import { getGitHubFile, isProductionMode } from '../github';
import { getBranch } from './git';
import { getErrorMessage } from './utils';

export type EntryDiff = {
  changed: boolean;
  activeBranch: string;
  baseBranch: string;
  /** Per-field diffs derived from the entry JSON `fields` object. */
  fields: Record<string, FieldDiff>;
  /** Raw before/after text for companion markdown/richtext files, keyed by field name. */
  companions: Record<string, { before: string | null; after: string | null }>;
  /** Resolved `/media/<uuid>.<ext>` URLs for image UUIDs appearing on either side of the diff. */
  imageUrls: Record<string, string>;
};

const emptyDiff = (activeBranch = '', baseBranch = ''): EntryDiff => ({
  changed: false,
  activeBranch,
  baseBranch,
  fields: {},
  companions: {},
  imageUrls: {},
});

/**
 * Read a file at a specific git ref. Returns `null` if the file doesn't exist on that ref.
 * - Production: GitHub API via {@link getGitHubFile}.
 * - Dev: `git show <ref>:<path>` for committed content, or the working-tree file when the ref
 *   matches the currently checked-out branch.
 */
async function readFileAtRef(filePath: string, ref: string, isProd: boolean): Promise<string | null> {
  if (isProd) {
    const result = await getGitHubFile(filePath, ref);
    return result ? result.content : null;
  }
  return await readFileAtGitRef(filePath, ref);
}

function readFileAtGitRef(filePath: string, ref: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile('git', ['show', `${ref}:${filePath}`], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        // `git show` exits non-zero if the path doesn't exist on that ref.
        resolve(null);
        return;
      }
      resolve(stdout.toString());
    });
  });
}

async function readWorkingTreeFile(filePath: string): Promise<string | null> {
  try {
    return await fsPromises.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Compute the diff between the currently active feature branch and the base branch for a
 * single entry's files (JSON + companion `.md` / `.mdx`). Read-only, best-effort: any failure
 * resolves to an empty diff so the UI never throws.
 */
export const getEntryDiff = async (filePath: string): Promise<EntryDiff> => {
  if (!filePath) return emptyDiff();

  try {
    const config = getConfig();
    const baseBranch = config.git.baseBranch;
    const activeBranch = await getBranch();
    const isProd = isProductionMode();

    // Same branch on both sides → no unmerged changes.
    if (!activeBranch || activeBranch === baseBranch) {
      return emptyDiff(activeBranch, baseBranch);
    }

    const { type: collectionType } = parseFileName(filePath);

    // --- Entry JSON ---------------------------------------------------------
    const [afterJson, beforeJson] = await Promise.all([
      isProd ? readFileAtRef(filePath, activeBranch, true) : readWorkingTreeFile(filePath),
      readFileAtRef(filePath, baseBranch, isProd),
    ]);

    const fields = diffEntryFields(safeParseEntry(beforeJson), safeParseEntry(afterJson));

    // --- Companion files ----------------------------------------------------
    const companionPaths = companionFilePathsForEntry(filePath, collectionType, config.collections);
    const companionEntries = Object.entries(companionPaths);

    const companionResults = await Promise.all(
      companionEntries.map(async ([fieldName, compPath]) => {
        const [after, before] = await Promise.all([
          isProd ? readFileAtRef(compPath, activeBranch, true) : readWorkingTreeFile(compPath),
          readFileAtRef(compPath, baseBranch, isProd),
        ]);
        return [fieldName, { before, after }] as const;
      }),
    );

    const companions: EntryDiff['companions'] = {};
    for (const [fieldName, payload] of companionResults) {
      companions[fieldName] = payload;
    }

    const hasFieldChange = Object.values(fields).some((d) => d.kind !== 'unchanged');
    const hasCompanionChange = Object.values(companions).some((c) => (c.before ?? '') !== (c.after ?? ''));

    // Resolve image UUIDs that changed on either side to `/media/<uuid>.<ext>` URLs.
    const collectionDef = (config.collections as Record<string, { fields: Record<string, { format?: string }> }>)[
      collectionType
    ];
    const imageFieldNames = collectionDef
      ? Object.entries(collectionDef.fields)
          .filter(([, f]) => f.format === 'image')
          .map(([name]) => name)
      : [];

    const imageUuids = new Set<string>();
    for (const name of imageFieldNames) {
      const d = fields[name];
      if (!d) continue;
      if (d.kind === 'added' && typeof d.after === 'string') imageUuids.add(d.after);
      else if (d.kind === 'removed' && typeof d.before === 'string') imageUuids.add(d.before);
      else if (d.kind === 'changed') {
        if (typeof d.before === 'string') imageUuids.add(d.before);
        if (typeof d.after === 'string') imageUuids.add(d.after);
      }
    }

    const imageUrls: Record<string, string> = {};
    if (imageUuids.size > 0) {
      const mediaDir = mediaContentFolder();
      const resolvePairs = await Promise.all(
        Array.from(imageUuids).map(async (uuid) => {
          if (!uuid || uuid.startsWith('/')) return [uuid, uuid] as const;
          // Prefer the active-branch media entry; fall back to base branch.
          let raw =
            (await readFileAtRef(mediaEntryPath(uuid), activeBranch, isProd)) ??
            (await readFileAtRef(mediaEntryPath(uuid), baseBranch, isProd));
          if (!raw) {
            // Legacy path: {uuid}.json (pre-`media-` prefix)
            raw =
              (await readFileAtRef(`${mediaDir}/${uuid}.json`, activeBranch, isProd)) ??
              (await readFileAtRef(`${mediaDir}/${uuid}.json`, baseBranch, isProd));
          }
          const parsed = safeParseEntry(raw);
          const ext = parsed && typeof parsed.fields?.extension === 'string' ? (parsed.fields.extension as string) : '';
          return [uuid, ext ? `/media/${uuid}.${ext}` : ''] as const;
        }),
      );
      for (const [uuid, url] of resolvePairs) {
        if (url) imageUrls[uuid] = url;
      }
    }

    return {
      changed: hasFieldChange || hasCompanionChange,
      activeBranch,
      baseBranch,
      fields,
      companions,
      imageUrls,
    };
  } catch (e) {
    logCmsServerError({ operation: 'getEntryDiff', message: getErrorMessage(e) });
    return emptyDiff();
  }
};
