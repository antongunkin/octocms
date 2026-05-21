import fsPromises from 'fs/promises';
import path from 'path';

import {
  isProductionMode,
  listGitHubFilesRecursive,
  readGitHubFilePublic,
  resolveContentBranch,
} from '../github-public';
import { getConfig } from './configStore';
import { listLocalFilesRecursive } from './localReader';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from './companionMarkdown';
import { buildSearchIndex, type EntryForSearch } from './searchIndex';

const PREBUILT_REL_PATH = 'cms/__generated__/search-index.json';

async function gatherEntriesFromLocalFs(publicCollectionKeys: string[]): Promise<EntryForSearch[]> {
  const config = getConfig();
  const files = await listLocalFilesRecursive(config.contentFolder, '.json');
  const entries: EntryForSearch[] = [];

  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    try {
      const type = normalized.split('/').at(-2);
      if (!type || !publicCollectionKeys.includes(type)) continue;

      const filePath = path.join(/* turbopackIgnore: true */ process.cwd(), normalized);
      const data = await fsPromises.readFile(filePath, { encoding: 'utf8' });
      const content = JSON.parse(data) as Record<string, unknown>;

      const companions: Record<string, string> = {};
      const mdPaths = companionMarkdownPathsForEntry(normalized, type, config.collections);
      for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
        try {
          const mdFilePath = path.join(/* turbopackIgnore: true */ process.cwd(), mdPath);
          companions[fieldName] = await fsPromises.readFile(mdFilePath, { encoding: 'utf8' });
        } catch {
          companions[fieldName] = '';
        }
      }
      const rtPaths = companionRichTextPathsForEntry(normalized, type, config.collections);
      for (const [fieldName, rtPath] of Object.entries(rtPaths)) {
        try {
          const rtFilePath = path.join(/* turbopackIgnore: true */ process.cwd(), rtPath);
          companions[fieldName] = await fsPromises.readFile(rtFilePath, { encoding: 'utf8' });
        } catch {
          companions[fieldName] = '';
        }
      }

      entries.push({
        path: normalized.replace(`${config.contentFolder}/`, ''),
        content,
        companionContent: companions,
      });
    } catch {
      /* skip */
    }
  }

  return entries;
}

async function gatherEntriesFromGitHubRef(ref: string, publicCollectionKeys: string[]): Promise<EntryForSearch[]> {
  const config = getConfig();
  const paths = await listGitHubFilesRecursive(config.contentFolder, '.json', ref);
  const entries: EntryForSearch[] = [];

  for (const p of paths) {
    const normalized = p.replace(/\\/g, '/');
    const parts = normalized.split('/');
    const type = parts.at(-2);
    if (!type || !publicCollectionKeys.includes(type)) continue;

    try {
      const raw = await readGitHubFilePublic(normalized, ref);
      if (!raw) continue;
      const content = JSON.parse(raw) as Record<string, unknown>;

      const companions: Record<string, string> = {};
      const mdPaths = companionMarkdownPathsForEntry(normalized, type, config.collections);
      for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
        try {
          companions[fieldName] = (await readGitHubFilePublic(mdPath, ref)) ?? '';
        } catch {
          companions[fieldName] = '';
        }
      }
      const rtPaths = companionRichTextPathsForEntry(normalized, type, config.collections);
      for (const [fieldName, rtPath] of Object.entries(rtPaths)) {
        try {
          companions[fieldName] = (await readGitHubFilePublic(rtPath, ref)) ?? '';
        } catch {
          companions[fieldName] = '';
        }
      }

      entries.push({
        path: normalized.replace(`${config.contentFolder}/`, ''),
        content,
        companionContent: companions,
      });
    } catch {
      /* skip */
    }
  }

  return entries;
}

/**
 * Serialized MiniSearch JSON for public `/api/search`, or `null` if search is disabled or nothing could be built.
 */
export async function loadPublicSearchIndexJson(): Promise<string | null> {
  const config = getConfig();
  const publicCollections = config.search?.publicCollections;
  if (!publicCollections || Object.keys(publicCollections).length === 0) {
    return null;
  }

  const keys = Object.keys(publicCollections);

  try {
    if (!isProductionMode()) {
      const prebuiltPath = path.join(/* turbopackIgnore: true */ process.cwd(), PREBUILT_REL_PATH);
      try {
        const existing = await fsPromises.readFile(prebuiltPath, 'utf8');
        if (existing.trim()) return existing;
      } catch {
        /* fall through to build from workspace */
      }
      const entries = await gatherEntriesFromLocalFs(keys);
      return buildSearchIndex(entries, config, keys);
    }

    const ref = await resolveContentBranch();
    const prebuilt = await readGitHubFilePublic(PREBUILT_REL_PATH, ref);
    if (prebuilt?.trim()) return prebuilt;

    const entries = await gatherEntriesFromGitHubRef(ref, keys);
    return buildSearchIndex(entries, config, keys);
  } catch {
    return null;
  }
}
