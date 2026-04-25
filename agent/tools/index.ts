/**
 * Tool registry for the chat agent. Two flavours:
 *
 *   - **Read-only tools** — `searchContent`, `listCollections`, `getEntry`. Run
 *     directly on the server and return their result string to the model.
 *   - **Proposal tools** — `proposeEdit`, `proposeNewEntry`. Validate the
 *     payload, then return BOTH a string for the model and a `proposal`
 *     object the chat loop emits as a `proposal` SSE event. The user must
 *     explicitly approve in the UI before any write happens — see
 *     `octocms/agent/proposals.ts`.
 *
 * Each tool exposes:
 *   - `definition` — the JSON schema sent to the model.
 *   - `run(input, ctx)` — server-side handler returning either a plain string
 *     (the model sees it as the tool result) or `{ message, proposal? }`.
 *     Errors are caught and stringified by the chat loop; we never throw out
 *     of `run`.
 */
import { randomUUID } from 'node:crypto';

import type { NormalizedTool } from '../providers/types';
import type { Config } from '../../types';
import {
  acceptProposal as _acceptProposal,
  describeCreateSummary,
  describeEditSummary,
  fieldsToFormStrings,
  resolveEntryPath,
  type CreateProposal,
  type EditProposal,
  type Proposal,
} from '../proposals';
import { searchContent } from '../search';

export type ToolRunResult =
  | string
  | {
      /** What the model sees as the tool result (must already be JSON-stringified). */
      message: string;
      /** Optional proposal — the chat loop emits it as an SSE event before the tool_result. */
      proposal?: Proposal;
    };

export type ToolHandler = {
  definition: NormalizedTool;
  run(input: unknown, ctx: ToolContext): Promise<ToolRunResult>;
};

export type ToolContext = {
  config: Config;
  branch?: string;
  /**
   * Wire-level `tool_use_id` for the current invocation. Proposal tools embed
   * this in the proposal so the UI can correlate accept/reject with the
   * originating tool call.
   */
  toolUseId?: string;
};

const searchContentTool: ToolHandler = {
  definition: {
    name: 'searchContent',
    description:
      'Semantic search over all CMS entries. Use this BEFORE answering any question about content. Returns ranked hits with title, score, and a short excerpt.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural-language search query.' },
        k: { type: 'integer', description: 'Number of results to return (1–25). Defaults to 8.', minimum: 1, maximum: 25 },
        collection: {
          type: 'string',
          description: 'Optional collection name to restrict the search (e.g. "post").',
        },
      },
      required: ['query'],
    },
  },
  async run(input, ctx) {
    const { query, k, collection } = (input ?? {}) as { query?: unknown; k?: unknown; collection?: unknown };
    if (typeof query !== 'string' || !query.trim()) {
      return JSON.stringify({ error: 'query is required and must be a non-empty string' });
    }
    const hits = await searchContent(query, {
      k: typeof k === 'number' ? Math.max(1, Math.min(25, Math.floor(k))) : 8,
      collection: typeof collection === 'string' && collection.trim() ? collection.trim() : undefined,
      branch: ctx.branch,
    });
    if (hits.length === 0) {
      return JSON.stringify({
        results: [],
        note: 'No results — verify the query, or try a broader phrasing. If embeddings.json is missing, run `npm run embeddings:gen` on your dev machine.',
      });
    }
    return JSON.stringify({
      results: hits.map((h) => ({
        id: h.id,
        path: h.path,
        collection: h.collection,
        score: Number(h.score.toFixed(4)),
        title: h.title,
        excerpt: h.excerpt,
      })),
    });
  },
};

const listCollectionsTool: ToolHandler = {
  definition: {
    name: 'listCollections',
    description:
      'List all collections in the schema with their fields and types. Useful when the user asks about content shape.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  async run(_input, ctx) {
    const collections = Object.entries(ctx.config.collections).map(([name, col]) => ({
      name,
      label: col.label,
      hasMany: Boolean(col.hasMany),
      fields: Object.entries(col.fields).map(([key, def]) => ({
        key,
        label: def.label,
        format: def.format,
        required: Boolean(def.required),
      })),
    }));
    return JSON.stringify({ collections });
  },
};

const getEntryTool: ToolHandler = {
  definition: {
    name: 'getEntry',
    description:
      'Fetch a single entry by its filename stem (the value returned in `id` from searchContent). Returns the raw `sys` + `fields` payload. Reference fields stay as their key strings — call getEntry again to expand them.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Filename stem, e.g. "post-abc".' },
        collection: {
          type: 'string',
          description:
            'Optional collection name. If omitted, the tool searches all collections by id (slower).',
        },
      },
      required: ['id'],
    },
  },
  async run(input, ctx) {
    const { id, collection } = (input ?? {}) as { id?: unknown; collection?: unknown };
    if (typeof id !== 'string' || !id.trim()) {
      return JSON.stringify({ error: 'id is required and must be a non-empty string' });
    }
    const cleanId = id.trim().replace(/\.json$/, '');
    const { getFile, getContentFiles } = (await import('../../admin/actions/files')) as typeof import(
      '../../admin/actions/files'
    );

    const colName = typeof collection === 'string' && collection.trim() ? collection.trim() : undefined;
    if (colName && !ctx.config.collections[colName as keyof typeof ctx.config.collections]) {
      return JSON.stringify({ error: `Unknown collection: ${colName}` });
    }

    const candidates = colName ? [colName] : Object.keys(ctx.config.collections);

    for (const c of candidates) {
      const entries = await getContentFiles(c).catch(() => [] as string[]);
      const match = entries.find((p) => {
        const stem = p.split('/').pop()?.replace(/\.json$/, '');
        return stem === cleanId;
      });
      if (!match) continue;
      try {
        const payload = await getFile(match);
        return JSON.stringify({ path: match, entry: payload });
      } catch (err) {
        return JSON.stringify({
          error: `Failed to read entry: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
    return JSON.stringify({ error: `No entry found with id "${cleanId}"` });
  },
};

const proposeEditTool: ToolHandler = {
  definition: {
    name: 'proposeEdit',
    description:
      'Propose changes to an existing entry. The user must explicitly accept the proposal in the UI before any write happens — you cannot save anything yourself. Always run `searchContent` and/or `getEntry` first to confirm the exact entry id and the existing field values you intend to change.',
    inputSchema: {
      type: 'object',
      properties: {
        entryId: {
          type: 'string',
          description: 'Filename stem of the entry to edit, e.g. "post-abc". Must match an existing entry.',
        },
        collection: {
          type: 'string',
          description: 'The collection the entry belongs to (e.g. "post"). Must match the entry.',
        },
        fieldChanges: {
          type: 'object',
          description:
            'Object of fieldName → new value. Only include fields you want to change. For markdown fields pass the full new body as a string. For reference (cardinality:many) fields pass an array of filename stems. Existing fields you omit stay as-is.',
          additionalProperties: true,
        },
        reasoning: {
          type: 'string',
          description: 'One sentence explaining why this change. Shown to the user verbatim on the approval card.',
        },
      },
      required: ['entryId', 'collection', 'fieldChanges', 'reasoning'],
    },
  },
  async run(input, ctx) {
    const { entryId, collection, fieldChanges, reasoning } = (input ?? {}) as {
      entryId?: unknown;
      collection?: unknown;
      fieldChanges?: unknown;
      reasoning?: unknown;
    };
    if (typeof entryId !== 'string' || !entryId.trim()) {
      return JSON.stringify({ ok: false, error: 'entryId is required (filename stem like "post-abc")' });
    }
    if (typeof collection !== 'string' || !collection.trim()) {
      return JSON.stringify({ ok: false, error: 'collection is required' });
    }
    if (!fieldChanges || typeof fieldChanges !== 'object' || Array.isArray(fieldChanges)) {
      return JSON.stringify({ ok: false, error: 'fieldChanges must be an object of fieldName → new value' });
    }
    const reasoningStr = typeof reasoning === 'string' ? reasoning.trim() : '';
    if (!reasoningStr) {
      return JSON.stringify({ ok: false, error: 'reasoning is required (one sentence)' });
    }

    const cleanCollection = collection.trim();
    if (!(cleanCollection in ctx.config.collections)) {
      return JSON.stringify({ ok: false, error: `Unknown collection: ${cleanCollection}` });
    }

    const cleanId = entryId.trim().replace(/\.json$/, '');
    const entryPath = await resolveEntryPath(cleanCollection, cleanId, ctx.config);
    if (!entryPath) {
      return JSON.stringify({ ok: false, error: `Entry "${cleanId}" not found in collection "${cleanCollection}".` });
    }

    // Re-validate the merged result against the schema. We need the existing
    // entry to merge against so we don't trip required-field checks on fields
    // the model isn't touching.
    const { getFile } = (await import('../../admin/actions/files')) as typeof import('../../admin/actions/files');
    let existing: { fields?: Record<string, unknown> };
    try {
      existing = await getFile(entryPath);
    } catch (err) {
      return JSON.stringify({
        ok: false,
        error: `Failed to read entry: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
    const merged = { ...existing.fields, ...(fieldChanges as Record<string, unknown>) };
    const stringFields = fieldsToFormStrings(merged);

    const { validateEntryFields } = (await import('../../lib/validateEntryFields')) as typeof import(
      '../../lib/validateEntryFields'
    );
    const validation = validateEntryFields(cleanCollection, stringFields);
    if (!validation.ok) {
      return JSON.stringify({
        ok: false,
        error: 'Validation failed — fix the field values and try again.',
        fieldErrors: validation.fieldErrors,
      });
    }

    const summary = describeEditSummary(cleanCollection, cleanId, fieldChanges as Record<string, unknown>);
    const proposal: EditProposal = {
      id: `prop_${randomUUID()}`,
      kind: 'edit',
      toolUseId: ctx.toolUseId ?? '',
      collection: cleanCollection,
      entryPath,
      entryId: cleanId,
      fieldChanges: fieldChanges as Record<string, unknown>,
      reasoning: reasoningStr,
      summary,
    };
    return {
      message: JSON.stringify({
        ok: true,
        proposalId: proposal.id,
        summary,
        awaitingApproval: true,
        note: 'Proposal emitted. The user will accept or reject it in the UI — do NOT propose the same change again.',
      }),
      proposal,
    };
  },
};

const proposeNewEntryTool: ToolHandler = {
  definition: {
    name: 'proposeNewEntry',
    description:
      'Propose a brand-new entry in a collection. The user must explicitly accept the proposal in the UI before any write happens. Use `listCollections` first if you are not sure of the available fields.',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string', description: 'Collection name to create the entry in.' },
        fields: {
          type: 'object',
          description:
            'Full proposed `fields` object. Required fields must be present. For markdown fields pass the full body as a string. For reference (cardinality:many) fields pass an array of filename stems.',
          additionalProperties: true,
        },
        reasoning: { type: 'string', description: 'One sentence explaining why this entry. Shown verbatim on the card.' },
      },
      required: ['collection', 'fields', 'reasoning'],
    },
  },
  async run(input, ctx) {
    const { collection, fields, reasoning } = (input ?? {}) as {
      collection?: unknown;
      fields?: unknown;
      reasoning?: unknown;
    };
    if (typeof collection !== 'string' || !collection.trim()) {
      return JSON.stringify({ ok: false, error: 'collection is required' });
    }
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return JSON.stringify({ ok: false, error: 'fields must be an object' });
    }
    const reasoningStr = typeof reasoning === 'string' ? reasoning.trim() : '';
    if (!reasoningStr) {
      return JSON.stringify({ ok: false, error: 'reasoning is required (one sentence)' });
    }

    const cleanCollection = collection.trim();
    if (!(cleanCollection in ctx.config.collections)) {
      return JSON.stringify({ ok: false, error: `Unknown collection: ${cleanCollection}` });
    }

    const stringFields = fieldsToFormStrings(fields as Record<string, unknown>);
    const { validateEntryFields } = (await import('../../lib/validateEntryFields')) as typeof import(
      '../../lib/validateEntryFields'
    );
    const validation = validateEntryFields(cleanCollection, stringFields);
    if (!validation.ok) {
      return JSON.stringify({
        ok: false,
        error: 'Validation failed — fix the field values and try again.',
        fieldErrors: validation.fieldErrors,
      });
    }

    const summary = describeCreateSummary(cleanCollection, fields as Record<string, unknown>);
    const proposal: CreateProposal = {
      id: `prop_${randomUUID()}`,
      kind: 'create',
      toolUseId: ctx.toolUseId ?? '',
      collection: cleanCollection,
      fields: fields as Record<string, unknown>,
      reasoning: reasoningStr,
      summary,
    };
    return {
      message: JSON.stringify({
        ok: true,
        proposalId: proposal.id,
        summary,
        awaitingApproval: true,
        note: 'Proposal emitted. The user will accept or reject it in the UI — do NOT propose the same entry again.',
      }),
      proposal,
    };
  },
};

/**
 * Phase 5 — match an uploaded document to a CMS entry.
 *
 * Two-tier strategy:
 *   1. URL hint match — if the user provides a URL or path, walk every
 *      collection's `routeTemplate` (e.g. `'/blog/[slug]'`) and try to extract
 *      field values. If the matched fields point at a real entry, return that
 *      entry as the highest-confidence candidate.
 *   2. Search fallback — embed the document text and run `searchContent` over
 *      the existing embeddings index. Returns the top hits.
 *
 * The model gets a ranked list with a `matchedBy` reason on each candidate
 * so it can surface them to the user and ask which one to update.
 */
const findEntryForDocumentTool: ToolHandler = {
  definition: {
    name: 'findEntryForDocument',
    description:
      'Given the text of an uploaded document (and optionally a URL hint), suggest CMS entries that the document is most likely about. Returns ranked candidates with a reason for the match. Use this BEFORE proposing edits when the user uploads a PDF / DOCX without naming a specific entry.',
    inputSchema: {
      type: 'object',
      properties: {
        documentText: {
          type: 'string',
          description:
            'The extracted text from the uploaded document — typically the first 1–2 paragraphs are enough to disambiguate.',
        },
        hintUrl: {
          type: 'string',
          description:
            "Optional URL or path the user mentioned, e.g. '/blog/my-post'. When set, exact matches against any collection's `routeTemplate` rank highest.",
        },
        k: {
          type: 'integer',
          description: 'Number of search-fallback candidates to return (1–10). Defaults to 5.',
          minimum: 1,
          maximum: 10,
        },
      },
      required: ['documentText'],
    },
  },
  async run(input, ctx) {
    const { documentText, hintUrl, k } = (input ?? {}) as {
      documentText?: unknown;
      hintUrl?: unknown;
      k?: unknown;
    };
    if (typeof documentText !== 'string' || !documentText.trim()) {
      return JSON.stringify({ error: 'documentText is required and must be a non-empty string' });
    }
    const limit = typeof k === 'number' ? Math.max(1, Math.min(10, Math.floor(k))) : 5;

    const candidates: Array<{
      id: string;
      path: string;
      collection: string;
      score: number;
      title: string;
      excerpt: string;
      matchedBy: 'routeTemplate' | 'search';
    }> = [];

    // 1) URL-hint matching against any collection's routeTemplate.
    if (typeof hintUrl === 'string' && hintUrl.trim()) {
      const cleanHint = hintUrl.trim();
      for (const [collectionName, collection] of Object.entries(ctx.config.collections)) {
        const template = (collection as { routeTemplate?: string }).routeTemplate;
        if (!template) continue;
        const fieldValues = matchRouteTemplate(template, cleanHint);
        if (!fieldValues) continue;
        const match = await findEntryByFieldValues(collectionName, fieldValues, ctx);
        if (match) {
          candidates.push({ ...match, matchedBy: 'routeTemplate' });
        }
      }
    }

    // 2) Search fallback — embed the document text and rank entries.
    const queryText = documentText.trim().slice(0, 2000);
    try {
      const hits = await searchContent(queryText, {
        k: limit,
        branch: ctx.branch,
      });
      for (const h of hits) {
        if (candidates.some((c) => c.path === h.path)) continue;
        candidates.push({ ...h, matchedBy: 'search' });
      }
    } catch (err) {
      return JSON.stringify({
        error: `Search fallback failed: ${err instanceof Error ? err.message : String(err)}`,
        candidates,
      });
    }

    if (candidates.length === 0) {
      return JSON.stringify({
        candidates: [],
        note: 'No candidates found — verify the document has searchable text, or ask the user which entry to update.',
      });
    }

    return JSON.stringify({
      candidates: candidates.map((c) => ({
        id: c.id,
        path: c.path,
        collection: c.collection,
        title: c.title,
        score: Number(c.score.toFixed(4)),
        excerpt: c.excerpt,
        matchedBy: c.matchedBy,
      })),
    });
  },
};

/**
 * Match a route template like `/blog/[slug]` (or `/items/[id]/[lang]`) against
 * a literal URL/path. Returns an object mapping each placeholder to the
 * captured value, or `null` if the template doesn't match. Query strings and
 * trailing slashes are ignored. Exposed for unit tests.
 */
export function matchRouteTemplate(template: string, url: string): Record<string, string> | null {
  // Drop scheme + host: '/blog/foo?x=1' → '/blog/foo'
  let path = url;
  const protoIdx = path.indexOf('://');
  if (protoIdx !== -1) {
    const slash = path.indexOf('/', protoIdx + 3);
    path = slash === -1 ? '/' : path.slice(slash);
  }
  const queryIdx = path.indexOf('?');
  if (queryIdx !== -1) path = path.slice(0, queryIdx);

  const norm = (s: string) => s.replace(/\/+$/, '') || '/';
  const tplParts = norm(template).split('/');
  const urlParts = norm(path).split('/');
  if (tplParts.length !== urlParts.length) return null;

  const out: Record<string, string> = {};
  for (let i = 0; i < tplParts.length; i++) {
    const tp = tplParts[i];
    const up = urlParts[i];
    const m = tp.match(/^\[(.+)\]$/);
    if (m) {
      if (!up) return null;
      out[m[1]] = decodeURIComponent(up);
    } else if (tp !== up) {
      return null;
    }
  }
  return out;
}

async function findEntryByFieldValues(
  collectionName: string,
  fieldValues: Record<string, string>,
  ctx: ToolContext,
): Promise<{ id: string; path: string; collection: string; score: number; title: string; excerpt: string } | null> {
  const { getFile, getContentFiles } = (await import('../../admin/actions/files')) as typeof import(
    '../../admin/actions/files'
  );
  const { resolveEntryTitle, resolveEntryId, buildEntryExcerpt } = (await import(
    '../../lib/resolveEntryTitle'
  )) as typeof import('../../lib/resolveEntryTitle');

  const entries = await getContentFiles(collectionName).catch(() => [] as string[]);
  for (const p of entries) {
    let payload: { sys?: { id?: unknown; type?: unknown }; fields?: Record<string, unknown> };
    try {
      payload = (await getFile(p)) as typeof payload;
    } catch {
      continue;
    }
    let allMatch = true;
    for (const [key, expected] of Object.entries(fieldValues)) {
      const actual = payload.fields?.[key];
      if (typeof actual !== 'string' || actual !== expected) {
        // Also accept matching against the filename stem when the placeholder is `id`.
        if (key === 'id') {
          const stem = p.split('/').pop()?.replace(/\.json$/, '');
          if (stem === expected) continue;
        }
        allMatch = false;
        break;
      }
    }
    if (!allMatch) continue;
    return {
      id: resolveEntryId(ctx.config, p, payload),
      path: p,
      collection: collectionName,
      score: 1,
      title: resolveEntryTitle(ctx.config, p, payload),
      excerpt: buildEntryExcerpt(ctx.config, p, payload),
    };
  }
  return null;
}

export const READ_ONLY_TOOLS: ToolHandler[] = [
  searchContentTool,
  listCollectionsTool,
  getEntryTool,
  findEntryForDocumentTool,
];

export const PROPOSAL_TOOLS: ToolHandler[] = [proposeEditTool, proposeNewEntryTool];

export const ALL_TOOLS: ToolHandler[] = [...READ_ONLY_TOOLS, ...PROPOSAL_TOOLS];

export function getToolHandler(name: string): ToolHandler | undefined {
  return ALL_TOOLS.find((t) => t.definition.name === name);
}

export function getToolDefinitions(): NormalizedTool[] {
  return ALL_TOOLS.map((t) => t.definition);
}

// Re-exported so callers don't need to reach into `proposals.ts` for the
// server-side accept handler.
export { _acceptProposal as acceptProposal };
