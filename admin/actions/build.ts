'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { glob } from 'glob';
import { revalidatePath, revalidateTag, updateTag } from 'next/cache';

import { getConfig } from '../../lib/configStore';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { buildSearchIndex, type EntryForSearch } from '../../lib/searchIndex';

import { isProductionMode, saveGitHubFile } from '../github';
import { actionErr, actionOk, type ActionResult } from './utils';

/** Cache tags used by `getHomePage` / `getBlog` / `getPublishedPosts` in `src/app/cms/ssr/getPageContent.ts`. */
const PUBLIC_CACHE_TAGS = ['homePage', 'blog'] as const;

const SEARCH_INDEX_FILE_PATH = 'cms/__generated__/search-index.json';

export type BuildJsonsOptions = {
  /** Slug-based `/blog/...` paths to revalidate in addition to the dynamic route segment. */
  blogPaths?: string[];
};

/** Helper: gather all searchable entries from the filesystem. */
async function getEntriesForPublicSearch(): Promise<EntryForSearch[]> {
  const config = getConfig();
  const publicCollections = config.search?.publicCollections;
  if (!publicCollections || Object.keys(publicCollections).length === 0) {
    return [];
  }

  const files = await glob(`${config.contentFolder}/**/*.json`);
  const entries: EntryForSearch[] = [];

  for (const file of files) {
    const normalized = file.replace(/\\/g, '/');
    try {
      const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), normalized);
      const data = await fsPromises.readFile(filePath, { encoding: 'utf8' });
      const content = JSON.parse(data) as Record<string, unknown>;
      const sys = content.sys as { type?: string } | undefined;
      const type = sys?.type;

      // Only include entries from publicCollections
      if (!type || !(type in publicCollections)) continue;

      // Read companion markdown/richtext files
      const companions: Record<string, string> = {};
      if (type) {
        const mdPaths = companionMarkdownPathsForEntry(normalized, type, config.collections);
        for (const [fieldName, mdPath] of Object.entries(mdPaths)) {
          try {
            const mdFilePath = path.join(/*turbopackIgnore: true*/ process.cwd(), mdPath);
            companions[fieldName] = await fsPromises.readFile(mdFilePath, { encoding: 'utf8' });
          } catch {
            companions[fieldName] = '';
          }
        }
        const rtPaths = companionRichTextPathsForEntry(normalized, type, config.collections);
        for (const [fieldName, rtPath] of Object.entries(rtPaths)) {
          try {
            const rtFilePath = path.join(/*turbopackIgnore: true*/ process.cwd(), rtPath);
            companions[fieldName] = await fsPromises.readFile(rtFilePath, { encoding: 'utf8' });
          } catch {
            companions[fieldName] = '';
          }
        }
      }

      entries.push({
        path: normalized.replace(`${config.contentFolder}/`, ''),
        content,
        companionContent: companions,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return entries;
}

/** Build and write the public search index. */
async function buildAndWriteSearchIndex(): Promise<void> {
  const config = getConfig();
  const publicCollections = config.search?.publicCollections;
  if (!publicCollections || Object.keys(publicCollections).length === 0) {
    return;
  }

  try {
    const entries = await getEntriesForPublicSearch();
    const indexJson = buildSearchIndex(entries, config, Object.keys(publicCollections));

    if (isProductionMode()) {
      // Write to GitHub
      await saveGitHubFile(SEARCH_INDEX_FILE_PATH, indexJson, 'CMS: update search index');
    } else {
      // Write to local filesystem
      const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), SEARCH_INDEX_FILE_PATH);
      await fsPromises.mkdir(path.dirname(filePath), { recursive: true });
      await fsPromises.writeFile(filePath, indexJson, 'utf8');
    }
  } catch {
    // Silently fail search index generation to not block the build
  }
}

export const buildJsons = async (_editedFileName?: string, options?: BuildJsonsOptions): Promise<ActionResult> => {
  try {
    for (const tag of PUBLIC_CACHE_TAGS) {
      // `updateTag` gives read-your-own-writes inside a Server Action (the
      // editor save path). When called from a Route Handler — e.g. the
      // proposal accept endpoint at `/api/agent/proposals/accept` — the
      // runtime throws ("updateTag can only be called from within a Server
      // Action"); fall back to `revalidateTag` with immediate expiry, which
      // is allowed everywhere and produces the same fresh-data outcome.
      try {
        updateTag(tag);
      } catch {
        revalidateTag(tag, { expire: 0 });
      }
    }

    revalidatePath('/', 'layout');
    revalidatePath('/blog', 'page');
    revalidatePath('/blog/[slug]', 'page');

    const seen = new Set<string>();
    for (const p of options?.blogPaths ?? []) {
      if (typeof p === 'string' && p.startsWith('/blog/') && !seen.has(p)) {
        seen.add(p);
        revalidatePath(p);
      }
    }

    // Build and write the public search index
    await buildAndWriteSearchIndex();

    return actionOk();
  } catch (e) {
    return actionErr(e);
  }
};
