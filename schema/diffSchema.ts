/**
 * Pure schema diff. Compares two `Config` snapshots and produces a flat list
 * of `SchemaChange` records describing what the visual editor changed.
 *
 * Renames cannot be inferred from add+remove pairs alone — they are ambiguous
 * (which removed key maps to which added key?). Callers that know about a
 * rename pass it explicitly via `DiffOptions`. Without a hint, a renamed key
 * surfaces as one `*-removed` plus one `*-added`.
 */

import type { CollectionField, Config } from '../types';

export type SchemaChange =
  | { kind: 'collection-added'; collection: string }
  | { kind: 'collection-removed'; collection: string }
  | { kind: 'collection-renamed'; from: string; to: string }
  | { kind: 'collection-hasMany-changed'; collection: string; from: boolean; to: boolean }
  | { kind: 'field-added'; collection: string; field: string; format: string }
  | { kind: 'field-removed'; collection: string; field: string; format: string }
  | { kind: 'field-renamed'; collection: string; from: string; to: string }
  | { kind: 'field-format-changed'; collection: string; field: string; from: string; to: string };

export interface DiffOptions {
  /** Maps a removed collection key to its renamed counterpart in `next`. */
  collectionRenames?: Readonly<Record<string, string>>;
  /**
   * Per-collection rename map for fields. Keys are collection names in `next`
   * (post-collection-rename); values map old field name → new field name.
   */
  fieldRenames?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

function hasMany(col: { hasMany?: boolean } | undefined): boolean {
  return col?.hasMany === true;
}

export function diffSchema(prev: Config, next: Config, options: DiffOptions = {}): SchemaChange[] {
  const changes: SchemaChange[] = [];
  const colRenames = options.collectionRenames ?? {};
  const reverseColRenames: Record<string, string> = {};
  for (const [from, to] of Object.entries(colRenames)) {
    reverseColRenames[to] = from;
  }

  const prevCols = Object.keys(prev.collections);
  const nextCols = Object.keys(next.collections);
  const prevSet = new Set(prevCols);
  const nextSet = new Set(nextCols);

  // 1. Collection-level: rename, remove, add, hasMany change
  for (const from of prevCols) {
    const renamedTo = colRenames[from];
    if (renamedTo && nextSet.has(renamedTo)) {
      changes.push({ kind: 'collection-renamed', from, to: renamedTo });
      continue;
    }
    if (!nextSet.has(from)) {
      changes.push({ kind: 'collection-removed', collection: from });
    }
  }
  for (const to of nextCols) {
    const renamedFrom = reverseColRenames[to];
    if (renamedFrom && prevSet.has(renamedFrom)) {
      // Already emitted as `collection-renamed`.
      continue;
    }
    if (!prevSet.has(to)) {
      changes.push({ kind: 'collection-added', collection: to });
    }
  }

  // 2. For each surviving collection (including renamed): hasMany change + field diff
  for (const nextKey of nextCols) {
    const prevKey = reverseColRenames[nextKey] ?? (prevSet.has(nextKey) ? nextKey : undefined);
    if (prevKey === undefined) continue; // newly-added collection — fields aren't a diff

    const prevCol = prev.collections[prevKey];
    const nextCol = next.collections[nextKey];
    if (!prevCol || !nextCol) continue;

    if (hasMany(prevCol) !== hasMany(nextCol)) {
      changes.push({
        kind: 'collection-hasMany-changed',
        collection: nextKey,
        from: hasMany(prevCol),
        to: hasMany(nextCol),
      });
    }

    diffFields(prevKey, nextKey, prevCol.fields, nextCol.fields, options.fieldRenames?.[nextKey] ?? {}, changes);
  }

  return changes;
}

function diffFields(
  prevColKey: string,
  nextColKey: string,
  prevFields: Record<string, CollectionField>,
  nextFields: Record<string, CollectionField>,
  fieldRenames: Readonly<Record<string, string>>,
  out: SchemaChange[],
): void {
  const reverseFieldRenames: Record<string, string> = {};
  for (const [from, to] of Object.entries(fieldRenames)) {
    reverseFieldRenames[to] = from;
  }

  const prevKeys = Object.keys(prevFields);
  const nextKeys = Object.keys(nextFields);
  const prevSet = new Set(prevKeys);
  const nextSet = new Set(nextKeys);

  // Renames + removes
  for (const from of prevKeys) {
    const renamedTo = fieldRenames[from];
    if (renamedTo && nextSet.has(renamedTo)) {
      out.push({ kind: 'field-renamed', collection: nextColKey, from, to: renamedTo });
      // Also surface a format change if the rename happened together with one
      const prevFmt = prevFields[from].format;
      const nextFmt = nextFields[renamedTo].format;
      if (prevFmt !== nextFmt) {
        out.push({
          kind: 'field-format-changed',
          collection: nextColKey,
          field: renamedTo,
          from: prevFmt,
          to: nextFmt,
        });
      }
      continue;
    }
    if (!nextSet.has(from)) {
      out.push({
        kind: 'field-removed',
        collection: prevColKey,
        field: from,
        format: prevFields[from].format,
      });
    }
  }

  // Adds + format-only changes on stable keys
  for (const to of nextKeys) {
    const renamedFrom = reverseFieldRenames[to];
    if (renamedFrom && prevSet.has(renamedFrom)) {
      continue; // emitted above
    }
    if (!prevSet.has(to)) {
      out.push({
        kind: 'field-added',
        collection: nextColKey,
        field: to,
        format: nextFields[to].format,
      });
      continue;
    }
    // Stable key, surviving field — check format change.
    const prevFmt = prevFields[to].format;
    const nextFmt = nextFields[to].format;
    if (prevFmt !== nextFmt) {
      out.push({
        kind: 'field-format-changed',
        collection: nextColKey,
        field: to,
        from: prevFmt,
        to: nextFmt,
      });
    }
  }
}
