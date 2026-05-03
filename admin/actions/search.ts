'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { glob } from 'glob';
import { cookies } from 'next/headers';

import { getConfig } from '../../lib/configStore';
import { companionMarkdownPathsForEntry, companionRichTextPathsForEntry } from '../../lib/companionMarkdown';
import { buildSearchIndex, querySearchIndex, type EntryForSearch, type SearchResult } from '../../lib/searchIndex';

import { isProductionMode } from '../github';
import { getOrBuildSearchIndex } from '../store/contentStore';

export type { SearchResult } from '../../lib/searchIndex';

const CMS_ACTIVE_BRANCH_COOKIE = 'cms-active-branch';

/**
 * Search across all CMS content entries. Used by the admin search UI.
 * In production, uses the content store's lazily-built index.
 * In dev, builds the index on-the-fly from local filesystem.
 */
export async function searchEntries(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  if (isProductionMode()) {
    return searchFromStore(query);
  }

  return searchFromFilesystem(query);
}

async function searchFromStore(query: string): Promise<SearchResult[]> {
  const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
  const serialized = await getOrBuildSearchIndex(activeBranch);
  if (!serialized) return [];
  return querySearchIndex(serialized, query);
}

async function searchFromFilesystem(query: string): Promise<SearchResult[]> {
  const config = getConfig();
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

  const serialized = buildSearchIndex(entries, config);
  return querySearchIndex(serialized, query);
}
