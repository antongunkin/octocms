import MiniSearch, { type Options } from 'minisearch';

import type { CollectionField, Config, PublicCollectionSearchConfig } from '../types';

// --- Types ---

export type SearchDocument = {
  id: string;
  type: string;
  typeLabel: string;
  title: string;
  content: string;
  snippet: string;
  url: string;
};

export type SearchResult = {
  type: string;
  typeLabel: string;
  id: string;
  title: string;
  score: number;
  match: Record<string, string[]>;
  url: string;
  snippet: string;
};

export type EntryForSearch = {
  /** Relative path, e.g. "post/post-abc123.json" */
  path: string;
  content: Record<string, unknown>;
  companionContent: Record<string, string>;
};

// --- Constants ---

const SEARCHABLE_BY_DEFAULT = new Set<string>(['string', 'text', 'markdown', 'richtext', 'slug', 'select']);

const MINISEARCH_OPTIONS: Options<SearchDocument> = {
  fields: ['title', 'content'],
  storeFields: ['type', 'typeLabel', 'title', 'url', 'snippet'],
  searchOptions: {
    boost: { title: 2 },
    prefix: true,
    fuzzy: 0.2,
  },
};

// --- Public functions ---

/**
 * Build the admin entry-editor href for a search hit. The hit's `id` is the
 * MiniSearch document id, encoded as `<type>/<filename-stem>` by
 * `entryToDocument`. The admin route at `/cms/content/<type>/<filename-stem>`
 * matches the per-segment route file at
 * `src/app/cms/content/[type]/[id]/page.tsx`.
 *
 * Use this for click navigation in admin search surfaces (full-page,
 * `CommandK` palette). For public-collection links, use `result.url`.
 */
export function entryAdminHref(result: { id: string }): string {
  const [type, ...rest] = result.id.split('/');
  const id = rest.join('/');
  return `/cms/content/${type}/${id}`;
}

/** Return searchable field names for a collection based on format + searchable flag. */
export function getSearchableFields(collectionName: string, config: Config): string[] {
  const col = config.collections[collectionName as keyof typeof config.collections];
  if (!col) return [];

  return Object.entries(col.fields)
    .filter(([, field]) => isFieldSearchable(field))
    .map(([key]) => key);
}

/** Strip MDX/HTML tags from richtext/markdown content, leaving only searchable plain text. */
export function stripMarkup(content: string): string {
  return (
    content
      // Remove import/export statements (MDX)
      .replace(/^(import|export)\s.+$/gm, '')
      // Remove HTML/JSX tags
      .replace(/<[^>]+>/g, '')
      // Remove markdown images ![alt](url)
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Convert markdown links [text](url) → text
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      // Remove heading markers
      .replace(/^#{1,6}\s+/gm, '')
      // Remove bold/italic markers
      .replace(/(\*{1,3}|_{1,3})(.+?)\1/g, '$2')
      // Remove fenced code block markers (but keep content)
      .replace(/^```\w*$/gm, '')
      // Remove inline code backticks
      .replace(/`([^`]+)`/g, '$1')
      // Remove horizontal rules
      .replace(/^[-*_]{3,}$/gm, '')
      // Remove blockquote markers
      .replace(/^>\s?/gm, '')
      // Collapse multiple newlines / whitespace
      .replace(/\n{2,}/g, '\n')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Resolve a URL pattern by substituting `:fieldName` placeholders with entry field values.
 * `:id` is special — uses `entry.content.sys.id`.
 * Returns null if a referenced field is empty/missing.
 */
export function resolveUrlPattern(pattern: string, entry: EntryForSearch, entryId: string): string | null {
  const placeholders = pattern.match(/:(\w+)/g);
  if (!placeholders) return pattern;

  let resolved = pattern;
  const fields = (entry.content as { fields?: Record<string, unknown> }).fields ?? {};

  for (const placeholder of placeholders) {
    const fieldName = placeholder.slice(1); // strip leading ':'
    let value: string | undefined;

    if (fieldName === 'id') {
      value = entryId;
    } else {
      const raw = fields[fieldName];
      value = typeof raw === 'string' && raw.length > 0 ? raw : undefined;
    }

    if (!value) return null;
    resolved = resolved.replace(placeholder, value);
  }

  return resolved;
}

/** Build a MiniSearch index from entries and serialize to JSON string. */
export function buildSearchIndex(
  entries: EntryForSearch[],
  config: Config,
  /** Only index entries from these collections. undefined = all. */
  collections?: string[],
): string {
  const miniSearch = new MiniSearch<SearchDocument>(MINISEARCH_OPTIONS);

  const publicCollections = config.search?.publicCollections;

  for (const entry of entries) {
    const doc = entryToDocument(entry, config, collections, publicCollections);
    if (doc) miniSearch.add(doc);
  }

  return JSON.stringify(miniSearch);
}

/** Load a serialized index and run a query. */
export function querySearchIndex(serializedIndex: string, query: string, limit = 50): SearchResult[] {
  if (!query.trim()) return [];

  const miniSearch = MiniSearch.loadJSON<SearchDocument>(serializedIndex, MINISEARCH_OPTIONS);
  const results = miniSearch.search(query, MINISEARCH_OPTIONS.searchOptions);

  return results.slice(0, limit).map((r) => ({
    type: r.type,
    typeLabel: r.typeLabel,
    id: r.id,
    title: r.title,
    score: r.score,
    match: r.match,
    url: r.url,
    snippet: (r.snippet as string | undefined) ?? '',
  }));
}

// --- Internal helpers ---

function isFieldSearchable(field: CollectionField): boolean {
  if (field.searchable === false) return false;
  if (field.searchable === true) return true;
  return SEARCHABLE_BY_DEFAULT.has(field.format);
}

function parseEntryPath(path: string): { type: string; id: string } | null {
  // path like "post/post-abc123.json"
  const parts = path.split('/');
  if (parts.length < 2) return null;
  const type = parts[parts.length - 2];
  const fileName = parts[parts.length - 1];
  const id = fileName.replace(/\.json$/, '');
  return { type, id };
}

/** Extract a snippet from content, truncating to maxLength and word boundary. */
function extractSnippet(text: string, maxLength = 200): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '\u2026';
}

function entryToDocument(
  entry: EntryForSearch,
  config: Config,
  allowedCollections: string[] | undefined,
  publicCollections: Record<string, PublicCollectionSearchConfig> | undefined,
): SearchDocument | null {
  const parsed = parseEntryPath(entry.path);
  if (!parsed) return null;

  const { type, id } = parsed;

  if (allowedCollections && !allowedCollections.includes(type)) return null;

  const col = config.collections[type as keyof typeof config.collections];
  if (!col) return null;

  const searchableFields = getSearchableFields(type, config);
  const fields = (entry.content as { fields?: Record<string, unknown> }).fields ?? {};

  // Build title from the entryTitle field
  const titleFieldKey = Object.entries(col.fields).find(([, f]) => f.entryTitle)?.[0];
  const title = titleFieldKey && typeof fields[titleFieldKey] === 'string' ? (fields[titleFieldKey] as string) : id;

  // Build content from all searchable fields (excluding the title field to avoid double-indexing)
  const contentParts: string[] = [];
  for (const fieldName of searchableFields) {
    if (fieldName === titleFieldKey) continue;

    const fieldDef = col.fields[fieldName];
    if (!fieldDef) continue;

    if (fieldDef.format === 'markdown' || fieldDef.format === 'richtext') {
      const companion = entry.companionContent[fieldName];
      if (companion) contentParts.push(stripMarkup(companion));
    } else if (fieldDef.format === 'select') {
      const raw = fields[fieldName];
      if (typeof raw === 'string') {
        const selectField = fieldDef as Extract<CollectionField, { format: 'select' }>;
        const option = selectField.options.find((o) => o.value === raw);
        contentParts.push(option?.label ?? raw);
      } else if (Array.isArray(raw)) {
        const selectField = fieldDef as Extract<CollectionField, { format: 'select' }>;
        for (const v of raw) {
          if (typeof v === 'string') {
            const option = selectField.options.find((o) => o.value === v);
            contentParts.push(option?.label ?? v);
          }
        }
      }
    } else {
      const raw = fields[fieldName];
      if (typeof raw === 'string') contentParts.push(raw);
      else if (Array.isArray(raw)) contentParts.push(raw.filter((v) => typeof v === 'string').join(' '));
    }
  }

  // Resolve URL for public search. Admin search must include every entry, so
  // a missing pattern field leaves `url` empty rather than dropping the entry.
  // Public consumers filter on `url !== ''` to skip unresolvable entries.
  let url = '';
  if (publicCollections && type in publicCollections) {
    const urlConfig = publicCollections[type];
    const resolved = resolveUrlPattern(urlConfig.urlPattern, entry, id);
    if (resolved !== null) url = resolved;
  }

  const contentText = contentParts.join(' ');
  return {
    id: `${type}/${id}`,
    type,
    typeLabel: col.label,
    title,
    content: contentText,
    snippet: extractSnippet(contentText),
    url,
  };
}
