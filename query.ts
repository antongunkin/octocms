import type { Config, ResolvedImageField } from "./types";
import type { InferConditions, CollectionNames } from "./defineConfig";
import {
  companionMarkdownPath,
  companionRichTextPath,
  getMarkdownFieldNames,
  getRichTextFieldNames,
} from "./lib/companionMarkdown";
import {
  getPublishedBranch,
  isProductionMode,
  listGitHubFiles,
  readGitHubFilePublic,
} from "./github-public";
import { parseRichText } from "./lib/richtext/parseRichText";

// ---------------------------------------------------------------------------
// Internal helpers — no dependency on user-app files
// ---------------------------------------------------------------------------

const readContentFile = async (
  filePath: string,
  branch?: string,
): Promise<any | null> => {
  const hasGitHubRepoConfig =
    !!process.env.GITHUB_REPO_OWNER && !!process.env.GITHUB_REPO_NAME;

  if (isProductionMode() && hasGitHubRepoConfig) {
    const content = await readGitHubFilePublic(filePath, branch);
    return content ? JSON.parse(content) : null;
  }

  // Dev-only: guarded so Turbopack dead-code-eliminates this block (and the dynamic import)
  // in production builds, preventing NFT from tracing the local filesystem helpers.
  if (process.env.NODE_ENV !== "production") {
    const { readLocalContentFile } = await import("./lib/localReader");
    return readLocalContentFile(filePath);
  }
  return null;
};

/** Read a raw text file (e.g. companion `.md`). Returns `""` when the file does not exist. */
const readRawFile = async (
  filePath: string,
  branch?: string,
): Promise<string> => {
  const hasGitHubRepoConfig =
    !!process.env.GITHUB_REPO_OWNER && !!process.env.GITHUB_REPO_NAME;

  if (isProductionMode() && hasGitHubRepoConfig) {
    const content = await readGitHubFilePublic(filePath, branch);
    return content ?? "";
  }

  if (process.env.NODE_ENV !== "production") {
    const { readLocalRawFile } = await import("./lib/localReader");
    return readLocalRawFile(filePath);
  }
  return "";
};

function pathImageField(src: string): ResolvedImageField {
  return { src, alt: "", width: null, height: null, blurDataURL: null };
}

/** Resolve the published branch once for a query execution. Undefined in dev (uses local FS). */
const resolvePublishedBranch = async (): Promise<string | undefined> => {
  const hasGitHubRepoConfig =
    !!process.env.GITHUB_REPO_OWNER && !!process.env.GITHUB_REPO_NAME;
  if (!isProductionMode() || !hasGitHubRepoConfig) return undefined;
  return getPublishedBranch();
};

const REFERENCE_KEY_REGEX = /^([^-]+)-(.+?)(?:\.json)?$/;

function toContentPathLocal(value: string, contentFolder: string): string {
  const match = value.match(REFERENCE_KEY_REGEX);
  if (!match) return "";
  const [, type, id] = match;
  return `${contentFolder}/${type}/${type}-${id}.json`;
}

async function resolveImageFieldValue(
  raw: string,
  contentFolder: string,
  branch?: string,
): Promise<ResolvedImageField | null> {
  if (!raw) return null;
  if (raw.startsWith("/")) {
    return pathImageField(raw);
  }

  const mediaDir = `${contentFolder}/media`;
  let mediaEntry = await readContentFile(
    `${mediaDir}/media-${raw}.json`,
    branch,
  );
  if (!mediaEntry) {
    // Legacy uploads may use `{uuid}.json` instead of `media-{uuid}.json`.
    mediaEntry = await readContentFile(`${mediaDir}/${raw}.json`, branch);
  }
  const ext = mediaEntry?.fields?.extension;
  if (typeof ext !== "string" || !ext) {
    return null;
  }

  const title =
    typeof mediaEntry.fields.title === "string"
      ? mediaEntry.fields.title.trim()
      : "";
  const width =
    typeof mediaEntry.fields.width === "number" && mediaEntry.fields.width > 0
      ? mediaEntry.fields.width
      : null;
  const height =
    typeof mediaEntry.fields.height === "number" && mediaEntry.fields.height > 0
      ? mediaEntry.fields.height
      : null;
  const blurRaw = mediaEntry.fields.blurDataURL;
  const blurDataURL =
    typeof blurRaw === "string" && blurRaw.length > 0 ? blurRaw : null;

  return {
    src: `/media/${raw}.${ext}`,
    alt: title,
    width,
    height,
    blurDataURL,
  };
}

/**
 * Resolve a richtext reference embed (CmsRef) by reading and processing the referenced entry.
 */
async function resolveReferenceEmbedValue(
  refKey: string,
  contentFolder: string,
  collections: Config["collections"],
  branch?: string,
): Promise<unknown | null> {
  if (!refKey) return null;
  const contentPath = toContentPathLocal(refKey, contentFolder);
  if (!contentPath) return null;
  const raw = await readContentFile(contentPath, branch);
  if (!raw) return null;
  return processEntry(raw, contentFolder, collections, branch);
}

/**
 * Resolve a conditional field value.
 */
async function resolveConditionalFieldValue(
  fieldConfig: any,
  storedValue: any,
  contentFolder: string,
  collections: Config["collections"],
  branch?: string,
  conditions?: Record<string, string>,
  fieldKey?: string,
  isTopLevel = false,
): Promise<any> {
  if (!storedValue || typeof storedValue !== "object") return storedValue;

  const branches = fieldConfig.conditional?.branches;
  if (!branches || !Array.isArray(branches)) return storedValue;

  const selectedKey = fieldKey && conditions ? conditions[fieldKey] : undefined;

  if (isTopLevel && conditions && !selectedKey && fieldKey) {
    const availableKeys = branches.map((b: any) => b.key).join(", ");
    throw new Error(
      `Missing condition for conditional field '${fieldKey}'. Available branch keys: ${availableKeys}`,
    );
  }

  if (!selectedKey) {
    const result: Record<string, any> = {};
    for (const branchDef of branches) {
      const branchValue = storedValue[branchDef.key];
      if (
        branchDef.collection &&
        typeof branchValue === "string" &&
        branchValue.trim()
      ) {
        const refPath = toContentPathLocal(branchValue, contentFolder);
        if (refPath) {
          const raw = await readContentFile(refPath, branch);
          result[branchDef.key] = await processEntry(
            raw,
            contentFolder,
            collections,
            branch,
            conditions,
          );
        } else {
          result[branchDef.key] = null;
        }
      } else if (
        branchDef.fields &&
        typeof branchValue === "object" &&
        branchValue
      ) {
        result[branchDef.key] = await resolveInlineBranchFields(
          branchDef.fields,
          branchValue,
          contentFolder,
          collections,
          branch,
          conditions,
        );
      } else {
        result[branchDef.key] = branchValue ?? null;
      }
    }
    return result;
  }

  const branchDef = branches.find((b: any) => b.key === selectedKey);
  if (!branchDef) return null;

  const branchValue = storedValue[selectedKey];

  if (
    branchDef.collection &&
    typeof branchValue === "string" &&
    branchValue.trim()
  ) {
    const refPath = toContentPathLocal(branchValue, contentFolder);
    if (refPath) {
      const raw = await readContentFile(refPath, branch);
      return processEntry(raw, contentFolder, collections, branch, conditions);
    }
    return null;
  }

  if (branchDef.fields && typeof branchValue === "object" && branchValue) {
    return resolveInlineBranchFields(
      branchDef.fields,
      branchValue,
      contentFolder,
      collections,
      branch,
      conditions,
    );
  }

  return branchValue ?? null;
}

/**
 * Resolve inline branch fields.
 */
async function resolveInlineBranchFields(
  branchFieldDefs: Record<string, any>,
  branchValues: Record<string, any>,
  contentFolder: string,
  collections: Config["collections"],
  branch?: string,
  conditions?: Record<string, string>,
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};

  for (const [subKey, subDef] of Object.entries(branchFieldDefs)) {
    let value = branchValues[subKey] ?? null;

    if (subDef.format === "image") {
      if (value != null && String(value).trim()) {
        const resolved = await resolveImageFieldValue(
          String(value).trim(),
          contentFolder,
          branch,
        );
        value = resolved ?? null;
      } else {
        value = null;
      }
    } else if (subDef.format === "reference") {
      const isSingle = subDef.reference?.cardinality === "one";
      let parsedPaths: string[] = [];

      if (isSingle) {
        const refPath = toContentPathLocal(String(value), contentFolder);
        if (refPath) parsedPaths = [refPath];
      } else {
        try {
          const parsed =
            typeof value === "string"
              ? JSON.parse(value)
              : Array.isArray(value)
                ? value
                : [];
          parsedPaths = Array.isArray(parsed)
            ? parsed
                .map((item: string) =>
                  toContentPathLocal(String(item), contentFolder),
                )
                .filter(Boolean)
            : [];
        } catch {
          /* skip */
        }
      }

      const references: any[] = [];
      for (const refPath of parsedPaths) {
        const raw = await readContentFile(refPath, branch);
        const resolved = await processEntry(
          raw,
          contentFolder,
          collections,
          branch,
          conditions,
        );
        if (resolved) references.push(resolved);
      }
      value = isSingle ? references[0] || null : references;
    } else if (subDef.format === "conditional") {
      value = await resolveConditionalFieldValue(
        subDef,
        value,
        contentFolder,
        collections,
        branch,
        conditions,
        subKey,
      );
    }

    result[subKey] = value;
  }

  return result;
}

/**
 * Resolve image UUID fields to `ResolvedImageField` objects and recursively
 * resolve reference fields to full entry objects.
 */
const processEntry = async (
  json: any,
  contentFolder: string,
  collections: Config["collections"],
  branch?: string,
  conditions?: Record<string, string>,
): Promise<any> => {
  if (!json) return null;

  const { sys, fields } = json;
  const collectionConfig = (collections as Record<string, any>)[sys.type];
  if (!collectionConfig) return json;

  const configFields = collectionConfig.fields ?? {};
  const referenceFieldNames = Object.keys(configFields).filter(
    (key: string) => configFields[key].format === "reference",
  );
  const imageFieldNames = Object.keys(configFields).filter(
    (key: string) => configFields[key].format === "image",
  );
  const conditionalFieldNames = Object.keys(configFields).filter(
    (key: string) => configFields[key].format === "conditional",
  );

  const formattedFields: Record<string, any> = {};

  for (const key of Object.keys(fields)) {
    let value = fields[key] ?? null;

    if (conditionalFieldNames.includes(key)) {
      value = await resolveConditionalFieldValue(
        configFields[key],
        value,
        contentFolder,
        collections,
        branch,
        conditions,
        key,
        true,
      );
      formattedFields[key] = value;
      continue;
    }

    if (referenceFieldNames.includes(key)) {
      const fieldConfig = configFields[key];
      const isSingle = fieldConfig.reference?.cardinality === "one";

      let parsedPaths: string[] = [];

      if (isSingle) {
        const refPath = toContentPathLocal(String(value), contentFolder);
        if (refPath) parsedPaths = [refPath];
      } else {
        try {
          const parsed = JSON.parse(value);
          parsedPaths = Array.isArray(parsed)
            ? parsed
                .map((item: string) =>
                  toContentPathLocal(String(item), contentFolder),
                )
                .filter(Boolean)
            : [];
        } catch (_e) {
          /* not valid JSON — skip */
        }
      }

      const references: any[] = [];
      for (const refPath of parsedPaths) {
        const raw = await readContentFile(refPath, branch);
        const resolved = await processEntry(
          raw,
          contentFolder,
          collections,
          branch,
        );
        if (resolved) references.push(resolved);
      }

      value = isSingle ? references[0] || null : references;
    }

    if (imageFieldNames.includes(key)) {
      if (value == null || !String(value).trim()) {
        value = null;
      } else {
        const resolved = await resolveImageFieldValue(
          String(value).trim(),
          contentFolder,
          branch,
        );
        value = resolved ?? null;
      }
    }

    formattedFields[key] = value;
  }

  // Resolve companion markdown files (markdown fields are omitted from JSON)
  const entryJsonPath = `${contentFolder}/${sys.type}/${sys.type}-${sys.id}.json`;
  const markdownFieldNames = getMarkdownFieldNames(sys.type, collections);
  for (const fieldName of markdownFieldNames) {
    const mdPath = companionMarkdownPath(entryJsonPath, fieldName);
    formattedFields[fieldName] = await readRawFile(mdPath, branch);
  }

  // Resolve companion richtext files (.mdx — richtext fields are omitted from JSON)
  const richTextFieldNames = getRichTextFieldNames(sys.type, collections);
  for (const fieldName of richTextFieldNames) {
    const mdxPath = companionRichTextPath(entryJsonPath, fieldName);
    const rawMdx = await readRawFile(mdxPath, branch);
    if (rawMdx) {
      formattedFields[fieldName] = await parseRichText(rawMdx, {
        resolveImage: (mediaId) =>
          resolveImageFieldValue(mediaId, contentFolder, branch),
        resolveReference: (refKey) =>
          resolveReferenceEmbedValue(
            refKey,
            contentFolder,
            collections,
            branch,
          ),
      });
    } else {
      formattedFields[fieldName] = { type: "doc", content: [] };
    }
  }

  return { sys, fields: formattedFields };
};

/** List all JSON entry file paths for a collection. */
const listCollectionFiles = async (
  collectionName: string,
  contentFolder: string,
  branch?: string,
): Promise<string[]> => {
  const dirPath = `${contentFolder}/${collectionName}`;
  const hasGitHubRepoConfig =
    !!process.env.GITHUB_REPO_OWNER && !!process.env.GITHUB_REPO_NAME;

  if (isProductionMode() && hasGitHubRepoConfig) {
    return listGitHubFiles(dirPath, ".json", branch);
  }

  if (process.env.NODE_ENV !== "production") {
    const { listLocalCollectionFiles } = await import("./lib/localReader");
    return listLocalCollectionFiles(dirPath);
  }
  return [];
};

// ---------------------------------------------------------------------------
// QueryBuilder — chainable, type-safe content selector
// ---------------------------------------------------------------------------

type SortDirection = "asc" | "desc";

/**
 * Chainable query builder for reading collection entries.
 *
 * Instantiate via `createQuery()`:
 * ```ts
 * // cms/__generated__/query.ts (auto-generated)
 * import { createQuery } from 'octocms/query';
 * import { config, type OctoConfig } from 'octocms/config';
 * import type { EntryMap } from './types';
 *
 * export const query = createQuery<EntryMap, OctoConfig>(config);
 * ```
 *
 * Then use:
 * ```ts
 * import { query } from 'cms/__generated__/query';
 *
 * const posts = await query('post')
 *   .filter((p) => p.fields.title !== '')
 *   .sort('publishedAt', 'desc')
 *   .limit(10)
 *   .toArray();
 * ```
 */
export class QueryBuilder<
  TEntryMap extends Record<string, any>,
  TOctoConfig extends Config,
  C extends keyof TEntryMap & string,
> {
  private _collection: C;
  private _octoConfig: TOctoConfig;
  private _conditions: Record<string, string> | undefined;
  private _filters: ((entry: TEntryMap[C]) => boolean)[] = [];
  private _sortField: Extract<keyof TEntryMap[C]["fields"], string> | null =
    null;
  private _sortDir: SortDirection = "asc";
  private _skip = 0;
  private _limit: number | null = null;
  private _includeDrafts = false;

  constructor(collection: C, octoConfig: TOctoConfig) {
    this._collection = collection;
    this._octoConfig = octoConfig;
  }

  /**
   * Set branch selections for conditional fields. Maps each conditional field name
   * to the branch key to resolve. When called, only the selected branch value is returned
   * for each conditional field; an error is thrown if a top-level conditional field key
   * is missing.
   *
   * Without `.conditions()`, all branches are returned as a keyed object.
   */
  conditions(
    conds: InferConditions<TOctoConfig, C & CollectionNames<TOctoConfig>>,
  ): QueryBuilder<TEntryMap, TOctoConfig, C> {
    this._conditions = conds as Record<string, string>;
    return this;
  }

  /**
   * Filter entries. Accepts either:
   * - A **predicate function** for full control:
   *   `.filter((e) => e.fields.publishedAt !== null)`
   * - A **partial fields object** for simple equality matching:
   *   `.filter({ title: 'Hello' })`
   *
   * Multiple `.filter()` calls are ANDed together.
   */
  filter(
    predicate:
      | ((entry: TEntryMap[C]) => boolean)
      | Partial<TEntryMap[C]["fields"]>,
  ): QueryBuilder<TEntryMap, TOctoConfig, C> {
    if (typeof predicate === "function") {
      this._filters.push(predicate);
    } else {
      const match = predicate;
      this._filters.push((entry) => {
        for (const key of Object.keys(match)) {
          if ((entry.fields as any)[key] !== (match as any)[key]) return false;
        }
        return true;
      });
    }
    return this;
  }

  /**
   * Sort entries by a field name.
   */
  sort(
    field: Extract<keyof TEntryMap[C]["fields"], string>,
    direction: SortDirection = "asc",
  ): QueryBuilder<TEntryMap, TOctoConfig, C> {
    this._sortField = field;
    this._sortDir = direction;
    return this;
  }

  /** Skip the first `n` results (for pagination). */
  skip(n: number): QueryBuilder<TEntryMap, TOctoConfig, C> {
    this._skip = n;
    return this;
  }

  /** Limit the result to at most `n` entries. */
  limit(n: number): QueryBuilder<TEntryMap, TOctoConfig, C> {
    this._limit = n;
    return this;
  }

  /**
   * Include draft and archived entries in results.
   *
   * By default, `query()` excludes entries with `sys.status` of `draft` or `archived`.
   * Call `.includeDrafts()` to return all entries regardless of status.
   */
  includeDrafts(): QueryBuilder<TEntryMap, TOctoConfig, C> {
    this._includeDrafts = true;
    return this;
  }

  /** Execute the query and return all matching entries as an array. */
  async toArray(): Promise<TEntryMap[C][]> {
    const contentFolder = this._octoConfig.contentFolder;
    const collections = this._octoConfig.collections;
    const branch = await resolvePublishedBranch();
    const files = await listCollectionFiles(
      this._collection,
      contentFolder,
      branch,
    );

    const rawEntries = await Promise.all(
      files.map((f) => readContentFile(f, branch)),
    );
    const processed: TEntryMap[C][] = [];

    for (const raw of rawEntries) {
      if (!raw) continue;
      const entry = await processEntry(
        raw,
        contentFolder,
        collections,
        branch,
        this._conditions,
      );
      if (entry) processed.push(entry as TEntryMap[C]);
    }

    let result = this._includeDrafts
      ? processed
      : processed.filter((entry) => {
          const status = (entry as any).sys?.status || "merged";
          return status !== "draft" && status !== "archived";
        });

    for (const fn of this._filters) {
      result = result.filter(fn);
    }

    if (this._sortField) {
      const field = this._sortField;
      const dir = this._sortDir === "asc" ? 1 : -1;
      result.sort((a, b) => {
        const av = (a.fields as any)[field];
        const bv = (b.fields as any)[field];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      });
    }

    if (this._skip > 0 || this._limit !== null) {
      const start = this._skip;
      const end = this._limit !== null ? start + this._limit : undefined;
      result = result.slice(start, end);
    }

    return result;
  }

  /**
   * Execute the query and return the first matching entry, or `null`.
   */
  async first(): Promise<TEntryMap[C] | null> {
    const prev = this._limit;
    this._limit = this._limit !== null ? Math.min(this._limit, 1) : 1;
    const results = await this.toArray();
    this._limit = prev;
    return results[0] ?? null;
  }

  /**
   * Execute the query and return `{ items, total, hasMore }`.
   */
  async paginate(): Promise<{
    items: TEntryMap[C][];
    total: number;
    hasMore: boolean;
  }> {
    const contentFolder = this._octoConfig.contentFolder;
    const collections = this._octoConfig.collections;
    const branch = await resolvePublishedBranch();
    const files = await listCollectionFiles(
      this._collection,
      contentFolder,
      branch,
    );
    const rawEntries = await Promise.all(
      files.map((f) => readContentFile(f, branch)),
    );
    const processed: TEntryMap[C][] = [];

    for (const raw of rawEntries) {
      if (!raw) continue;
      const entry = await processEntry(
        raw,
        contentFolder,
        collections,
        branch,
        this._conditions,
      );
      if (entry) processed.push(entry as TEntryMap[C]);
    }

    let filtered = this._includeDrafts
      ? processed
      : processed.filter((entry) => {
          const status = (entry as any).sys?.status || "merged";
          return status !== "draft" && status !== "archived";
        });

    for (const fn of this._filters) {
      filtered = filtered.filter(fn);
    }

    if (this._sortField) {
      const field = this._sortField;
      const dir = this._sortDir === "asc" ? 1 : -1;
      filtered.sort((a, b) => {
        const av = (a.fields as any)[field];
        const bv = (b.fields as any)[field];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        if (av < bv) return -dir;
        if (av > bv) return dir;
        return 0;
      });
    }

    const total = filtered.length;
    const start = this._skip;
    const end = this._limit !== null ? start + this._limit : undefined;
    const items = filtered.slice(start, end);
    const hasMore = end !== undefined ? end < total : false;

    return { items, total, hasMore };
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a type-safe content query function bound to your app's config and generated types.
 *
 * Call this once to create your app's `query` function, then import and use it everywhere:
 *
 * ```ts
 * // cms/__generated__/query.ts (auto-generated by `npm run types:gen`)
 * import { createQuery } from 'octocms/query';
 * import { config, type OctoConfig } from 'octocms/config';
 * import type { EntryMap } from './types';
 *
 * export const query = createQuery<EntryMap, OctoConfig>(config);
 * ```
 *
 * Then in your pages/components:
 * ```ts
 * import { query } from 'cms/__generated__/query';
 *
 * const posts = await query('post').sort('publishedAt', 'desc').toArray();
 * ```
 */
export function createQuery<
  TEntryMap extends Record<string, any>,
  TOctoConfig extends Config,
>(
  octoConfig: TOctoConfig,
): <C extends keyof TEntryMap & string>(
  collection: C,
) => QueryBuilder<TEntryMap, TOctoConfig, C> {
  return function <C extends keyof TEntryMap & string>(
    collection: C,
  ): QueryBuilder<TEntryMap, TOctoConfig, C> {
    return new QueryBuilder<TEntryMap, TOctoConfig, C>(collection, octoConfig);
  };
}
