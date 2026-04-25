/**
 * Pure entry-migration helpers. Given a `SchemaChange[]` from `diffSchema`,
 * apply the data-shape implications to a single entry and report companion
 * file moves/deletes that the caller must perform on disk.
 *
 * Design notes:
 *  - These helpers are entirely pure. They neither read nor write files; the
 *    caller (the schema save server action) batches the resulting file ops
 *    into a single GitHub commit alongside the schema write.
 *  - Format coercion is conservative. When a value cannot be safely coerced,
 *    the field is dropped and a warning is appended. The caller surfaces the
 *    warnings to the user before committing — see Phase 6 (impact analysis).
 *  - Reference fields whose target collections shrink are NOT auto-pruned
 *    here; that's a content-level concern handled by the impact analysis
 *    pass.
 */

import type { CollectionField, Config } from '../types';
import type { SchemaChange } from './diffSchema';

/**
 * Minimal in-memory shape of an entry. Mirrors what `getFile()` returns from
 * disk, with companion-file fields already merged in as strings.
 */
export interface ContentEntry {
  sys: { id: string; type: string; status?: string; [k: string]: unknown };
  fields: Record<string, unknown>;
  /** Repo-relative path of the entry JSON file. */
  path: string;
}

/** A companion-file (markdown / richtext) operation produced by a migration. */
export type CompanionFileOp = { kind: 'rename'; from: string; to: string } | { kind: 'delete'; path: string };

export type EntryFileOp = { kind: 'rename'; from: string; to: string } | { kind: 'delete'; path: string };

export interface EntryMigrationResult {
  /** The migrated entry, or `null` if the entry should be deleted. */
  entry: ContentEntry | null;
  /** Required moves/deletes for the entry JSON file itself. */
  fileOps: EntryFileOp[];
  /** Required moves/deletes for companion `.md` / `.mdx` files. */
  companionOps: CompanionFileOp[];
  /** Human-readable warnings (e.g. data lost during a format change). */
  warnings: string[];
}

/** Per-collection summary of changes that affect entries in that collection. */
interface CollectionImpact {
  /** Old → new collection key when this collection was renamed. */
  rename?: { from: string; to: string };
  /** True if the collection was deleted. */
  removed: boolean;
  /** Field renames that apply to this collection (old → new). */
  fieldRenames: Record<string, string>;
  /** Removed field names (from the prev schema). */
  removedFields: { field: string; format: string }[];
  /** Format changes (key, prev format, next format). Field key is in the *next* schema. */
  formatChanges: { field: string; from: string; to: string }[];
}

/**
 * Group `SchemaChange[]` by the collection they affect (using the *prev* key
 * for removals and the *next* key everywhere else).
 */
export function groupChangesByCollection(changes: readonly SchemaChange[]): Map<string, CollectionImpact> {
  const out = new Map<string, CollectionImpact>();
  const ensure = (key: string): CollectionImpact => {
    let v = out.get(key);
    if (!v) {
      v = { removed: false, fieldRenames: {}, removedFields: [], formatChanges: [] };
      out.set(key, v);
    }
    return v;
  };

  for (const c of changes) {
    switch (c.kind) {
      case 'collection-renamed':
        ensure(c.from).rename = { from: c.from, to: c.to };
        // Also expose under the new name so downstream lookups by next-key work.
        ensure(c.to).rename = { from: c.from, to: c.to };
        break;
      case 'collection-removed':
        ensure(c.collection).removed = true;
        break;
      case 'collection-added':
      case 'collection-hasMany-changed':
        // No per-entry migration needed.
        break;
      case 'field-renamed':
        ensure(c.collection).fieldRenames[c.from] = c.to;
        break;
      case 'field-removed':
        ensure(c.collection).removedFields.push({ field: c.field, format: c.format });
        break;
      case 'field-format-changed':
        ensure(c.collection).formatChanges.push({ field: c.field, from: c.from, to: c.to });
        break;
      case 'field-added':
        // Adding a field is no-op for existing entries (queries see `undefined`).
        break;
    }
  }

  return out;
}

/** Companion-file extensions for the field formats that use them. */
function companionExtForFormat(format: string): '.md' | '.mdx' | null {
  if (format === 'markdown') return '.md';
  if (format === 'richtext') return '.mdx';
  return null;
}

function companionPath(entryJsonPath: string, fieldName: string, ext: '.md' | '.mdx'): string {
  return `${entryJsonPath.replace(/\.json$/, '')}.${fieldName}${ext}`;
}

/**
 * Best-effort coerce a value when a field's format changes. Returns the
 * coerced value, or `undefined` to indicate the value should be dropped (the
 * caller adds a warning).
 *
 * The coercion table is intentionally narrow — anything risky (markdown ↔
 * richtext, reference ↔ string, etc.) drops the value rather than producing
 * subtly broken content.
 */
function coerceFieldValue(value: unknown, fromFormat: string, toFormat: string): unknown {
  if (value == null) return value;

  const fromString = (): string | undefined => {
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return undefined;
  };

  // text-like family: free conversion among string / text / slug / url / color
  // (validation may reject the new format later, but that's the user's problem)
  const TEXTY = new Set(['string', 'text', 'slug', 'url', 'color']);
  if (TEXTY.has(fromFormat) && TEXTY.has(toFormat)) {
    return fromString();
  }

  // string ↔ markdown / richtext: drop. Markdown lives in companion files; a
  // string field cannot meaningfully roundtrip through one without manual review.
  if ((fromFormat === 'markdown' || fromFormat === 'richtext') && toFormat !== fromFormat) return undefined;
  if ((toFormat === 'markdown' || toFormat === 'richtext') && fromFormat !== toFormat) return undefined;

  // boolean → string family: keep "true"/"false" string.
  if (fromFormat === 'boolean' && TEXTY.has(toFormat)) return fromString();
  if (TEXTY.has(fromFormat) && toFormat === 'boolean') {
    const s = fromString();
    if (s === 'true' || s === 'false') return s;
    return undefined;
  }

  // number → string family
  if (fromFormat === 'number' && TEXTY.has(toFormat)) return fromString();
  if (TEXTY.has(fromFormat) && toFormat === 'number') {
    const s = fromString();
    if (s == null) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? n : undefined;
  }

  // datetime ↔ string family: pass through (the editor will reject bad shapes).
  if (fromFormat === 'datetime' && TEXTY.has(toFormat)) return fromString();
  if (TEXTY.has(fromFormat) && toFormat === 'datetime') return fromString();

  // select / reference / image / json / conditional: drop on any change. These
  // formats have storage shapes that don't round-trip safely.
  return undefined;
}

export interface MigrateEntryOptions {
  /** Schema *before* the changes — used to enumerate companion fields when a
   *  collection or field is renamed. Optional: callers without it accept that
   *  some companion-file moves may be missed and surface a warning instead. */
  prevConfig?: Config;
}

/**
 * Apply schema changes to a single entry. Returns the migrated entry plus the
 * companion-file operations the caller must perform on disk.
 */
export function migrateEntry(
  entry: ContentEntry,
  changes: readonly SchemaChange[],
  options: MigrateEntryOptions = {},
): EntryMigrationResult {
  const grouped = groupChangesByCollection(changes);
  const warnings: string[] = [];
  const fileOps: EntryFileOp[] = [];
  const companionOps: CompanionFileOp[] = [];

  const collectionKey = entry.sys.type;
  const impact = grouped.get(collectionKey);

  // 1. Collection-level: removed → delete entry + every companion file, return null.
  if (impact?.removed) {
    fileOps.push({ kind: 'delete', path: entry.path });
    const prevCol = options.prevConfig?.collections[collectionKey];
    if (prevCol) {
      for (const [fieldName, def] of Object.entries(prevCol.fields)) {
        const ext = companionExtForFormat(def.format);
        if (ext) companionOps.push({ kind: 'delete', path: companionPath(entry.path, fieldName, ext) });
      }
    }
    return { entry: null, fileOps, companionOps, warnings };
  }

  // 2. Collection-level: renamed → file move (entry JSON + every companion).
  let nextEntry: ContentEntry = {
    ...entry,
    sys: { ...entry.sys },
    fields: { ...entry.fields },
  };
  let nextPath = entry.path;
  if (impact?.rename) {
    const { from, to } = impact.rename;
    // Path is `cms/content/<from>/<from>-<id>.json` — rename folder and stem.
    nextPath = entry.path.replace(`/content/${from}/`, `/content/${to}/`).replace(new RegExp(`/${from}-`), `/${to}-`);
    fileOps.push({ kind: 'rename', from: entry.path, to: nextPath });
    nextEntry.sys.type = to;
    nextEntry.path = nextPath;
  }

  // 3. Field-level: renames first (so subsequent ops reference the new key).
  if (impact) {
    for (const [oldKey, newKey] of Object.entries(impact.fieldRenames)) {
      if (oldKey in nextEntry.fields) {
        nextEntry.fields[newKey] = nextEntry.fields[oldKey];
        delete nextEntry.fields[oldKey];
      }
    }

    // Removed fields: drop from JSON; queue companion-file deletion when the
    // removed field stored its content in a `.md` / `.mdx`.
    for (const { field, format } of impact.removedFields) {
      if (field in nextEntry.fields) {
        delete nextEntry.fields[field];
      }
      const ext = companionExtForFormat(format);
      if (ext) {
        // Use the entry's pre-rename path: companion files live next to the JSON
        // *before* any collection rename move, but after the rename the move is
        // already in `fileOps`. Use the new path if a rename occurred.
        companionOps.push({ kind: 'delete', path: companionPath(nextPath, field, ext) });
      }
    }

    // Format changes: try coercion, drop on failure with a warning. Companion
    // files are renamed/deleted as the format gains/loses companion storage.
    for (const { field, from, to } of impact.formatChanges) {
      const fromExt = companionExtForFormat(from);
      const toExt = companionExtForFormat(to);

      if (fromExt && toExt && fromExt !== toExt) {
        // markdown ↔ richtext companion-file rename.
        companionOps.push({
          kind: 'rename',
          from: companionPath(nextPath, field, fromExt),
          to: companionPath(nextPath, field, toExt),
        });
        continue;
      }
      if (fromExt && !toExt) {
        // Companion file becomes inline data. We can't import the file
        // contents from a pure function, so warn and drop.
        companionOps.push({ kind: 'delete', path: companionPath(nextPath, field, fromExt) });
        warnings.push(
          `Field "${field}" on ${collectionKey} changed from ${from} to ${to}; companion file content was dropped.`,
        );
        continue;
      }
      if (!fromExt && toExt) {
        // Inline value would need to become a companion file, but the inline
        // data lives on the entry. The caller handles writing the new
        // companion file — we just remove the inline value here and warn.
        if (field in nextEntry.fields) {
          warnings.push(
            `Field "${field}" on ${collectionKey} changed from ${from} to ${to}; inline value should be promoted to a companion ${toExt} file before save.`,
          );
          delete nextEntry.fields[field];
        }
        continue;
      }

      // Inline ↔ inline: best-effort coerce.
      if (field in nextEntry.fields) {
        const before = nextEntry.fields[field];
        const after = coerceFieldValue(before, from, to);
        if (after === undefined) {
          delete nextEntry.fields[field];
          warnings.push(
            `Field "${field}" on ${collectionKey} changed from ${from} to ${to}; existing value could not be coerced and was dropped.`,
          );
        } else {
          nextEntry.fields[field] = after;
        }
      }
    }
  }

  // 4. Companion-file moves implied by a collection rename. Companion files
  //    keep the same stem suffix (`<stem>.<field>.md`), so they move from
  //    `<oldPath>.<field>.md` to `<nextPath>.<field>.md` for every markdown
  //    or richtext field that exists in the *prev* collection.
  if (impact?.rename && entry.path !== nextPath) {
    const prevCol = options.prevConfig?.collections[impact.rename.from];
    if (prevCol) {
      for (const [fieldName, def] of Object.entries(prevCol.fields)) {
        const ext = companionExtForFormat(def.format);
        if (!ext) continue;
        // Skip if this field was also removed (already queued above).
        if (impact.removedFields.some((r) => r.field === fieldName)) continue;
        // Account for field renames inside the rename'd collection.
        const newName = impact.fieldRenames[fieldName] ?? fieldName;
        companionOps.push({
          kind: 'rename',
          from: companionPath(entry.path, fieldName, ext),
          to: companionPath(nextPath, newName, ext),
        });
      }
    } else {
      warnings.push(
        `Collection "${impact.rename.from}" was renamed to "${impact.rename.to}"; pass prevConfig to migrateEntry to move companion .md / .mdx files.`,
      );
    }
  }

  return { entry: nextEntry, fileOps, companionOps, warnings };
}

// ---------------------------------------------------------------------------
// Phase 6 — cross-collection reference migration
// ---------------------------------------------------------------------------

/** Summary of what a reference-migration pass did to a single entry. */
export interface ReferenceMigrationResult {
  /** The (possibly mutated) entry. Same object identity as input when nothing changed. */
  entry: ContentEntry;
  /** True when at least one reference field value was rewritten or pruned. */
  changed: boolean;
  /** How many reference keys were rewritten in place (collection rename). */
  rewritten: number;
  /** How many reference keys were dropped because their collection no longer exists. */
  pruned: number;
}

const REF_KEY_RE = /^([^-]+)-(.+)\.json$/;

/**
 * Parse the collection prefix from a reference key like `author-abc.json`.
 * Returns `null` when the input is not a recognisable reference key.
 */
function parseRefCollection(key: string): string | null {
  const m = REF_KEY_RE.exec(key);
  return m ? m[1] : null;
}

/** Apply a key transform (rename / prune) to one reference key. */
function transformRefKey(
  key: string,
  collectionRenames: Readonly<Record<string, string>>,
  removedCollections: ReadonlySet<string>,
): { key: string | null; rewritten: boolean; pruned: boolean } {
  const col = parseRefCollection(key);
  if (col === null) return { key, rewritten: false, pruned: false };
  if (removedCollections.has(col)) return { key: null, rewritten: false, pruned: true };
  const renamed = collectionRenames[col];
  if (renamed && renamed !== col) {
    return { key: `${renamed}-${key.slice(col.length + 1)}`, rewritten: true, pruned: false };
  }
  return { key, rewritten: false, pruned: false };
}

/**
 * Apply collection rename / removal to a single reference field value.
 *
 * Reference values come in three serialised shapes:
 *  - JSON-stringified array (`'["author-a1.json","author-a2.json"]'`) — many cardinality
 *  - Plain string key (`'author-a1.json'`) — one cardinality
 *  - Native array (rare; some legacy callers) — many cardinality
 */
function migrateReferenceFieldValue(
  value: unknown,
  collectionRenames: Readonly<Record<string, string>>,
  removedCollections: ReadonlySet<string>,
): { value: unknown; rewritten: number; pruned: number } {
  if (value == null || value === '') return { value, rewritten: 0, pruned: 0 };

  let asArray: string[] | null = null;
  let serialise: 'json-array' | 'string' | 'array' = 'string';
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) {
      asArray = value as string[];
      serialise = 'array';
    }
  } else if (typeof value === 'string') {
    if (value.startsWith('[')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) {
          asArray = parsed as string[];
          serialise = 'json-array';
        }
      } catch {
        /* not JSON — fall through to single-key handling */
      }
    }
    if (asArray === null) {
      const t = transformRefKey(value, collectionRenames, removedCollections);
      if (t.pruned) return { value: null, rewritten: 0, pruned: 1 };
      if (t.rewritten) return { value: t.key, rewritten: 1, pruned: 0 };
      return { value, rewritten: 0, pruned: 0 };
    }
  }

  if (asArray === null) return { value, rewritten: 0, pruned: 0 };

  let rewritten = 0;
  let pruned = 0;
  const next: string[] = [];
  for (const k of asArray) {
    const t = transformRefKey(k, collectionRenames, removedCollections);
    if (t.pruned) {
      pruned++;
      continue;
    }
    if (t.rewritten && t.key !== null) {
      rewritten++;
      next.push(t.key);
      continue;
    }
    next.push(k);
  }

  if (rewritten === 0 && pruned === 0) return { value, rewritten, pruned };

  return {
    value: serialise === 'json-array' ? JSON.stringify(next) : next,
    rewritten,
    pruned,
  };
}

/** Reference-format fields on a collection (per the prev schema). */
function referenceFieldsOf(collection: { fields: Record<string, CollectionField> } | undefined): string[] {
  if (!collection) return [];
  return Object.keys(collection.fields).filter((k) => collection.fields[k]?.format === 'reference');
}

/**
 * Apply schema changes to every reference field on an entry, propagating
 * collection renames (rewrite reference keys) and collection removals (prune
 * orphaned reference keys). Pure — does not write anywhere.
 *
 * Designed to run on every entry in the repo, not just entries inside the
 * affected collections — references can live anywhere.
 */
export function migrateReferences(
  entry: ContentEntry,
  changes: readonly SchemaChange[],
  prevConfig: Config,
): ReferenceMigrationResult {
  const collectionRenames: Record<string, string> = {};
  const removed = new Set<string>();
  for (const c of changes) {
    if (c.kind === 'collection-renamed') collectionRenames[c.from] = c.to;
    if (c.kind === 'collection-removed') removed.add(c.collection);
  }
  if (Object.keys(collectionRenames).length === 0 && removed.size === 0) {
    return { entry, changed: false, rewritten: 0, pruned: 0 };
  }

  // Look up reference fields by the entry's *prev* collection key.
  const prevCollectionKey =
    Object.entries(collectionRenames).find(([, to]) => to === entry.sys.type)?.[0] ?? entry.sys.type;
  const prevCol = prevConfig.collections[prevCollectionKey];
  const refFields = referenceFieldsOf(prevCol);
  if (refFields.length === 0) {
    return { entry, changed: false, rewritten: 0, pruned: 0 };
  }

  let rewrittenTotal = 0;
  let prunedTotal = 0;
  const nextFields: Record<string, unknown> = { ...entry.fields };
  let changed = false;
  for (const fieldKey of refFields) {
    const before = entry.fields[fieldKey];
    const { value: after, rewritten, pruned } = migrateReferenceFieldValue(before, collectionRenames, removed);
    if (rewritten === 0 && pruned === 0) continue;
    nextFields[fieldKey] = after;
    rewrittenTotal += rewritten;
    prunedTotal += pruned;
    changed = true;
  }

  if (!changed) return { entry, changed: false, rewritten: 0, pruned: 0 };

  return {
    entry: { ...entry, fields: nextFields },
    changed: true,
    rewritten: rewrittenTotal,
    pruned: prunedTotal,
  };
}
