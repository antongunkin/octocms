'use server';

import fsPromises from 'fs/promises';
import path from 'path';

import { cookies } from 'next/headers';

import { regenerateAll } from '../../cli/lib/codegen';
import { validateConfig } from '../../cli/lib/validateConfig';
import { diffSchema, type DiffOptions, type SchemaChange } from '../../schema/diffSchema';
import { migrateEntry, migrateReferences, type ContentEntry } from '../../schema/migrateContent';
import type { Config } from '../../types';

import { commitMultipleFilesToGitHub, getGitHubFile, isProductionMode, type GitHubBatchChange } from '../github';
import { buildJsons } from './build';
import { assertFeatureBranchForWritesIfRequired, getContentFiles, getFile } from './files';
import { actionErr, actionOk, getErrorMessage, type ActionResult } from './utils';

const CMS_ACTIVE_BRANCH_COOKIE = 'cms-active-branch';
const SCHEMA_PATH = 'cms/schema.json';

// ---------------------------------------------------------------------------
// getSchema
// ---------------------------------------------------------------------------

/**
 * Read `cms/schema.json` from the active feature branch (prod) or local
 * filesystem (dev). Returns the parsed `Config`.
 */
export const getSchema = async (): Promise<Config> => {
  if (process.env.NODE_ENV === 'production' || isProductionMode()) {
    const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;
    const file = await getGitHubFile(SCHEMA_PATH, activeBranch);
    if (!file) {
      throw new Error(`schema not found at ${SCHEMA_PATH} on branch ${activeBranch ?? '(default)'}`);
    }
    return JSON.parse(file.content) as Config;
  }

  const raw = await fsPromises.readFile(path.join(process.cwd(), SCHEMA_PATH), 'utf8');
  return JSON.parse(raw) as Config;
};

// ---------------------------------------------------------------------------
// previewSchemaChange
// ---------------------------------------------------------------------------

export interface SchemaImpactItem {
  /** Repo-relative entry JSON path. */
  path: string;
  /** Entry collection. */
  type: string;
  /** Entry id (filename stem without `.json`). */
  id: string;
  /** Display title (entry-title field if present, otherwise the id). */
  title: string;
  /** Why this entry is affected (one entry per change kind that touches it). */
  reasons: string[];
  /** Warnings produced by the migration pass for this entry. */
  warnings: string[];
  /** True when applying the change discards content (deleted entries, dropped
   *  field values, pruned references, or coercion failures). */
  dataLoss: boolean;
}

export interface PreviewSchemaResult {
  valid: boolean;
  errors: string[];
  /** Empty when validation failed. */
  changes: SchemaChange[];
  /** Empty when validation failed. */
  impact: SchemaImpactItem[];
}

/**
 * Run the schema diff, the validator, and a content scan to predict which
 * entries the change will touch. Read-only — never writes anything.
 */
export const previewSchemaChange = async (next: Config, options: DiffOptions = {}): Promise<PreviewSchemaResult> => {
  const errors: string[] = [];

  try {
    validateConfig(next, Object.keys(next.collections));
  } catch (e) {
    errors.push(getErrorMessage(e));
    return { valid: false, errors, changes: [], impact: [] };
  }

  const prev = await getSchema();
  const changes = diffSchema(prev, next, options);
  if (changes.length === 0) {
    return { valid: true, errors, changes, impact: [] };
  }

  const affectedCollections = collectAffectedCollections(changes);
  const referenceTargets = collectReferenceTargets(changes);
  const handledPaths = new Set<string>();

  const impactByPath = new Map<string, SchemaImpactItem>();
  const upsertImpact = (
    entry: ContentEntry,
    reason: string,
    opts: { warnings?: string[]; dataLoss?: boolean } = {},
  ) => {
    let item = impactByPath.get(entry.path);
    if (!item) {
      item = {
        path: entry.path,
        type: entry.sys.type,
        id: parseEntryId(entry.path),
        title: entryTitle(entry, prev),
        reasons: [],
        warnings: [],
        dataLoss: false,
      };
      impactByPath.set(entry.path, item);
    }
    if (!item.reasons.includes(reason)) item.reasons.push(reason);
    for (const w of opts.warnings ?? []) {
      if (!item.warnings.includes(w)) item.warnings.push(w);
    }
    if (opts.dataLoss) item.dataLoss = true;
  };

  // 1. Direct hits: entries inside affected collections (renamed / removed /
  //    field-changed). Filter to only entries materially affected — we don't
  //    surface no-op rewrites (e.g. dropping a field that the entry never set).
  for (const collectionKey of affectedCollections) {
    const files = await getContentFiles(collectionKey);
    for (const filePath of files) {
      let raw: unknown;
      try {
        raw = await getFile(filePath);
      } catch {
        continue;
      }
      const entry = coerceContentEntry(raw, filePath);
      if (!entry) continue;

      const result = migrateEntry(entry, changes, { prevConfig: prev });

      const detail = describeEntryImpact(changes, collectionKey, entry);
      // Skip when nothing in the entry changes and no migration warning fired.
      if (detail.reasons.length === 0 && result.warnings.length === 0) continue;

      handledPaths.add(filePath);
      const reason = detail.reasons.join('; ') || 'collection affected';
      // Migration warnings (coercion failure, dropped companion content, etc.)
      // are always data loss regardless of which change triggered them.
      const dataLoss = detail.dataLoss || result.warnings.length > 0;
      upsertImpact(entry, reason, { warnings: result.warnings, dataLoss });
    }
  }

  // 2. Cross-collection reference migration: scan every other entry and apply
  //    the reference-rewrite/prune pass. Only entries whose values change are
  //    surfaced (so stale entries with no orphaned refs stay out of the list).
  if (referenceTargets.size > 0) {
    const allFiles = await getContentFiles('**');
    for (const filePath of allFiles) {
      if (handledPaths.has(filePath)) continue;

      let raw: unknown;
      try {
        raw = await getFile(filePath);
      } catch {
        continue;
      }
      const entry = coerceContentEntry(raw, filePath);
      if (!entry) continue;

      const refResult = migrateReferences(entry, changes, prev);
      if (!refResult.changed) continue;

      const parts: string[] = [];
      if (refResult.rewritten > 0) {
        parts.push(`${refResult.rewritten} reference${refResult.rewritten === 1 ? '' : 's'} will be rewritten`);
      }
      if (refResult.pruned > 0) {
        parts.push(`${refResult.pruned} orphaned reference${refResult.pruned === 1 ? '' : 's'} will be removed`);
      }
      upsertImpact(entry, parts.join(' · '), { dataLoss: refResult.pruned > 0 });
    }
  }

  return {
    valid: true,
    errors,
    changes,
    impact: Array.from(impactByPath.values()),
  };
};

function parseEntryId(filePath: string): string {
  const stem = filePath.split('/').pop() ?? filePath;
  return stem.replace(/\.json$/, '');
}

function coerceContentEntry(raw: unknown, filePath: string): ContentEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const sys = (raw as { sys?: unknown }).sys;
  const fields = (raw as { fields?: unknown }).fields;
  if (!sys || typeof sys !== 'object') return null;
  const type = (sys as { type?: unknown }).type;
  const id = (sys as { id?: unknown }).id;
  if (typeof type !== 'string' || typeof id !== 'string') return null;
  return {
    sys: { ...(sys as ContentEntry['sys']), type, id },
    fields: fields && typeof fields === 'object' ? (fields as Record<string, unknown>) : {},
    path: filePath,
  };
}

function collectAffectedCollections(changes: readonly SchemaChange[]): Set<string> {
  const out = new Set<string>();
  for (const c of changes) {
    switch (c.kind) {
      case 'collection-renamed':
        out.add(c.from);
        break;
      case 'collection-removed':
        out.add(c.collection);
        break;
      case 'field-renamed':
      case 'field-removed':
      case 'field-format-changed':
        out.add(c.collection);
        break;
      default:
        break;
    }
  }
  return out;
}

function collectReferenceTargets(changes: readonly SchemaChange[]): Set<string> {
  const out = new Set<string>();
  for (const c of changes) {
    if (c.kind === 'collection-removed') out.add(c.collection);
    if (c.kind === 'collection-renamed') out.add(c.from);
  }
  return out;
}

/**
 * Per-entry impact summary. Each change kind decides whether it materially
 * affects this entry — e.g. dropping a field that's already null is a no-op
 * we don't surface, but dropping a field with a value is data loss.
 */
function describeEntryImpact(
  changes: readonly SchemaChange[],
  collectionKey: string,
  entry: ContentEntry,
): { reasons: string[]; dataLoss: boolean } {
  const reasons: string[] = [];
  let dataLoss = false;

  for (const c of changes) {
    if (c.kind === 'collection-removed' && c.collection === collectionKey) {
      reasons.push('collection deleted');
      dataLoss = true;
      continue;
    }
    if (c.kind === 'collection-renamed' && c.from === collectionKey) {
      reasons.push(`collection renamed → ${c.to}`);
      // Data preserved (file move + sys.type rewrite).
      continue;
    }
    if (c.kind === 'field-removed' && c.collection === collectionKey) {
      const hasValue = fieldHasValue(entry.fields[c.field]);
      const companionImplied = c.format === 'markdown' || c.format === 'richtext';
      if (!hasValue && !companionImplied) continue; // no-op, skip
      reasons.push(`field deleted: ${c.field}`);
      if (hasValue || companionImplied) dataLoss = true;
      continue;
    }
    if (c.kind === 'field-renamed' && c.collection === collectionKey) {
      const hasValue = fieldHasValue(entry.fields[c.from]);
      // Always surface a rename (so users know which entries are touched), but
      // only emit "data" wording when there's actually a value to carry over.
      reasons.push(hasValue ? `field renamed: ${c.from} → ${c.to}` : `field renamed (no data): ${c.from} → ${c.to}`);
      // No data loss — value moves to the new key.
      continue;
    }
    if (c.kind === 'field-format-changed' && c.collection === collectionKey) {
      const hasValue = fieldHasValue(entry.fields[c.field]);
      if (!hasValue) continue; // empty value, format change is structural-only
      reasons.push(`field format changed: ${c.field} (${c.from} → ${c.to})`);
      // Data-loss flag is set later if migrateEntry produced a warning for this entry.
    }
  }

  return { reasons, dataLoss };
}

/** True when a stored field value would survive a `delete entry.fields[k]`. */
function fieldHasValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Best-effort entry title — uses the field marked `entryTitle: true` when set. */
function entryTitle(entry: ContentEntry, prev: Config): string {
  const col = prev.collections[entry.sys.type];
  if (col) {
    const titleKey = Object.entries(col.fields).find(([, f]) => f.entryTitle === true)?.[0];
    if (titleKey) {
      const v = entry.fields[titleKey];
      if (typeof v === 'string' && v.trim().length > 0) return v;
    }
  }
  return parseEntryId(entry.path);
}

// ---------------------------------------------------------------------------
// saveSchema
// ---------------------------------------------------------------------------

export interface SaveSchemaOptions extends DiffOptions {
  /** Optional commit message override. */
  message?: string;
}

/**
 * Validate the new schema, run content migrations, and commit
 * `cms/schema.json` + every regenerated artifact + every migrated entry as a
 * single GitHub commit on the active feature branch (prod) or as filesystem
 * writes (dev). Then bust public caches via `buildJsons('')`.
 *
 * Gated by `assertFeatureBranchForWritesIfRequired` — production refuses to
 * write directly to `git.baseBranch`.
 */
export const saveSchema = async (next: Config, options: SaveSchemaOptions = {}): Promise<ActionResult> => {
  try {
    // 1. Validate (throws on failure).
    validateConfig(next, Object.keys(next.collections));

    // 2. Diff against the current schema and run migrations on every entry.
    const prev = await getSchema();
    const changes = diffSchema(prev, next, options);

    const affectedCollections = collectAffectedCollections(changes);
    const referenceTargets = collectReferenceTargets(changes);
    const entryWrites: { path: string; content: string }[] = [];
    const entryRenames: { from: string; to: string }[] = [];
    const entryDeletes: string[] = [];
    const companionRenames: { from: string; to: string }[] = [];
    const companionDeletes: string[] = [];
    const handledPaths = new Set<string>();

    for (const collectionKey of affectedCollections) {
      const files = await getContentFiles(collectionKey);
      for (const filePath of files) {
        let raw: unknown;
        try {
          raw = await getFile(filePath);
        } catch {
          continue;
        }
        const entry = coerceContentEntry(raw, filePath);
        if (!entry) continue;
        const result = migrateEntry(entry, changes, { prevConfig: prev });
        handledPaths.add(filePath);

        // Apply cross-collection reference rewrites/prunes on the already-
        // migrated entry (so a renamed collection's own entries get their
        // self-referential keys updated too).
        let migrated = result.entry;
        if (migrated) {
          const refResult = migrateReferences(migrated, changes, prev);
          migrated = refResult.entry;
        }

        for (const op of result.fileOps) {
          if (op.kind === 'delete') entryDeletes.push(op.path);
          if (op.kind === 'rename') {
            entryRenames.push({ from: op.from, to: op.to });
            if (migrated) {
              entryWrites.push({
                path: op.to,
                content: JSON.stringify(stripPath(migrated), null, 2) + '\n',
              });
            }
          }
        }
        if (
          migrated &&
          result.fileOps.every((op) => op.kind !== 'rename') &&
          result.fileOps.every((op) => op.kind !== 'delete')
        ) {
          // Field-level changes only — overwrite the existing file in place.
          entryWrites.push({
            path: filePath,
            content: JSON.stringify(stripPath(migrated), null, 2) + '\n',
          });
        }

        for (const op of result.companionOps) {
          if (op.kind === 'delete') companionDeletes.push(op.path);
          if (op.kind === 'rename') companionRenames.push({ from: op.from, to: op.to });
        }
      }
    }

    // Cross-collection reference migration: for every other entry in the repo,
    // rewrite refs into renamed collections and prune refs into removed
    // collections. Pure field-value rewrites — no companion or file moves.
    if (referenceTargets.size > 0) {
      const allFiles = await getContentFiles('**');
      for (const filePath of allFiles) {
        if (handledPaths.has(filePath)) continue;

        let raw: unknown;
        try {
          raw = await getFile(filePath);
        } catch {
          continue;
        }
        const entry = coerceContentEntry(raw, filePath);
        if (!entry) continue;
        const refResult = migrateReferences(entry, changes, prev);
        if (!refResult.changed) continue;
        entryWrites.push({
          path: filePath,
          content: JSON.stringify(stripPath(refResult.entry), null, 2) + '\n',
        });
      }
    }

    // 3. Generate every schema-driven artifact.
    const { files: schemaFiles } = regenerateAll(next);

    // 4. Commit.
    const message =
      options.message ?? `CMS: update schema (${changes.length} change${changes.length === 1 ? '' : 's'})`;

    if (process.env.NODE_ENV === 'production' || isProductionMode()) {
      await assertFeatureBranchForWritesIfRequired();
      const activeBranch = (await cookies()).get(CMS_ACTIVE_BRANCH_COOKIE)?.value;

      // Read companion file contents for renames before queuing the move.
      // (GitHub tree commits delete the old path and create the new one.)
      const companionRenamePairs = await Promise.all(
        companionRenames.map(async ({ from, to }) => {
          const file = await getGitHubFile(from, activeBranch);
          return file ? { from, to, content: file.content } : null;
        }),
      );

      const batch: GitHubBatchChange[] = [];

      for (const [filePath, content] of Object.entries(schemaFiles)) {
        batch.push({ kind: 'upsert-text', path: filePath, content });
      }
      for (const { path: p, content } of entryWrites) {
        batch.push({ kind: 'upsert-text', path: p, content });
      }
      for (const { from, to } of entryRenames) {
        batch.push({ kind: 'delete', path: from });
        // The new path is already pushed via entryWrites above.
        void to;
      }
      for (const path of entryDeletes) {
        batch.push({ kind: 'delete', path });
      }
      for (const pair of companionRenamePairs) {
        if (!pair) continue;
        batch.push({ kind: 'delete', path: pair.from });
        batch.push({ kind: 'upsert-text', path: pair.to, content: pair.content });
      }
      for (const path of companionDeletes) {
        batch.push({ kind: 'delete', path });
      }

      await commitMultipleFilesToGitHub(batch, message, activeBranch);
    } else {
      // Dev: filesystem writes (no atomic batch — fs is local and fast enough
      // that partial-failure recovery isn't worth the complexity).
      const root = process.cwd();

      for (const [relPath, content] of Object.entries(schemaFiles)) {
        const abs = path.join(root, relPath);
        await fsPromises.mkdir(path.dirname(abs), { recursive: true });
        await fsPromises.writeFile(abs, content, 'utf8');
      }
      for (const { path: p, content } of entryWrites) {
        const abs = path.join(root, p);
        await fsPromises.mkdir(path.dirname(abs), { recursive: true });
        await fsPromises.writeFile(abs, content, 'utf8');
      }
      for (const { from } of entryRenames) {
        await fsPromises.rm(path.join(root, from), { force: true });
      }
      for (const p of entryDeletes) {
        await fsPromises.rm(path.join(root, p), { force: true });
      }
      for (const { from, to } of companionRenames) {
        try {
          await fsPromises.mkdir(path.dirname(path.join(root, to)), { recursive: true });
          await fsPromises.rename(path.join(root, from), path.join(root, to));
        } catch {
          /* missing companion — best-effort */
        }
      }
      for (const p of companionDeletes) {
        await fsPromises.rm(path.join(root, p), { force: true });
      }
    }

    // 5. Bust caches.
    const built = await buildJsons('');
    return built.success ? actionOk() : built;
  } catch (e) {
    return actionErr(e);
  }
};

function stripPath(entry: ContentEntry): { sys: ContentEntry['sys']; fields: ContentEntry['fields'] } {
  return { sys: entry.sys, fields: entry.fields };
}
