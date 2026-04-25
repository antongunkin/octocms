/**
 * Pure helper that turns a content entry into the plain-text payload we feed
 * to the embedding model. One vector per entry — every leaf field plus
 * companion `.md` / `.mdx` content is flattened into a single string.
 *
 * Reference fields keep the raw key strings (e.g. `"author-abc.json"`) — we
 * don't resolve them. The model still gets a useful signal (the key encodes
 * the collection) and we avoid recursive lookups during indexing.
 *
 * Field-name labels are included to give the model coarse semantic anchors
 * (`title:`, `body:`, …) without overwhelming the actual content.
 */

type EntryLike = {
  fields?: Record<string, unknown>;
};

function valueToText(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(valueToText).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    // For objects (image fields, JSON blobs, etc.) — flatten leaf string/number values.
    const parts: string[] = [];
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const text = valueToText(v);
      if (text) parts.push(`${k}: ${text}`);
    }
    return parts.join(', ');
  }
  return '';
}

/**
 * Flatten an entry's fields plus companion-file contents into a single
 * embedding-ready string. Companion contents take precedence when a field
 * name appears in both (matches `getFile`'s merge order — companion wins).
 */
export function entryToEmbeddingText(entry: EntryLike, companions: Record<string, string> = {}): string {
  const lines: string[] = [];
  const fields = entry.fields ?? {};

  for (const [key, value] of Object.entries(fields)) {
    if (key in companions) continue; // handled below — companion content wins
    const text = valueToText(value).trim();
    if (text) lines.push(`${key}: ${text}`);
  }

  for (const [key, content] of Object.entries(companions)) {
    const trimmed = (content ?? '').trim();
    if (trimmed) lines.push(`${key}: ${trimmed}`);
  }

  return lines.join('\n');
}
