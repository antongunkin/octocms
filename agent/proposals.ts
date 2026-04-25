/**
 * Proposal types + the server-side accept handler shared by the
 * `/api/agent/proposals/accept` route and (in tests) direct callers.
 *
 * Phase 4 of the chat agent. Mutating tool calls (`proposeEdit`,
 * `proposeNewEntry`) never touch content directly — they emit proposal
 * objects that the user accepts or rejects in the UI. The actual write
 * happens here, on the stateless accept endpoint, which re-validates the
 * payload before calling `saveFile` / `newFile`.
 *
 * The proposal payload travels:
 *   tool handler → SSE `proposal` event → client React state → POST /accept
 *
 * Server state is intentionally NOT kept between the SSE stream and the
 * accept endpoint — Vercel-safe, see RAG_PLAN.md Phase 4.
 */
import type { Config } from '../types';

/** Common fields on every proposal. */
type ProposalBase = {
  /** Stable id for UI keying — generated server-side, not used by the accept endpoint. */
  id: string;
  /** Tool-use id that emitted the proposal. Lets the UI correlate cards with their tool call. */
  toolUseId: string;
  /** One-sentence rationale from the model — surfaced verbatim on the card. */
  reasoning: string;
  /** Short human-readable label, e.g. "Edit post 'My title' (title, body)". */
  summary: string;
};

export type EditProposal = ProposalBase & {
  kind: 'edit';
  collection: string;
  /** Full content path to the entry, e.g. `cms/content/post/post-abc.json`. */
  entryPath: string;
  /** Filename stem, e.g. `post-abc`. Surfaced for UI/citation only. */
  entryId: string;
  /** Object of fieldName → new raw value. Only the fields being changed. */
  fieldChanges: Record<string, unknown>;
};

export type CreateProposal = ProposalBase & {
  kind: 'create';
  collection: string;
  /** Full proposed `fields` block for the new entry. */
  fields: Record<string, unknown>;
};

export type Proposal = EditProposal | CreateProposal;

export type AcceptResult =
  | { ok: true; entryPath: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Coerce arbitrary field values to strings so that `validateEntryFields` and
 * `saveFile` (which both expect form-style strings) can consume them.
 *
 * Mirrors the same coercion `saveFile` does internally on the form payload.
 */
export function fieldsToFormStrings(fields: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v == null) {
      out[k] = '';
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

/**
 * Locate the on-disk path for an entry given its filename stem and collection.
 * Returns `null` if no match. Used by `proposeEdit` to validate that the model
 * referenced a real entry before emitting a proposal.
 */
export async function resolveEntryPath(
  collection: string,
  entryId: string,
  config: Config,
): Promise<string | null> {
  if (!(collection in config.collections)) return null;
  const cleanId = entryId.trim().replace(/\.json$/, '');
  const { getContentFiles } = (await import('../admin/actions/files')) as typeof import(
    '../admin/actions/files'
  );
  const entries = await getContentFiles(collection).catch(() => [] as string[]);
  const match = entries.find((p) => {
    const stem = p.split('/').pop()?.replace(/\.json$/, '');
    return stem === cleanId;
  });
  return match ?? null;
}

/**
 * Server-side execution of an accepted proposal. Re-validates the payload,
 * then runs the corresponding write action. Stateless — does not trust any
 * server-side memory of the proposal; everything is re-checked from the
 * payload + current entry state on disk.
 */
export async function acceptProposal(proposal: Proposal): Promise<AcceptResult> {
  const { saveFile, newFile, getFile } = (await import('../admin/actions/files')) as typeof import(
    '../admin/actions/files'
  );

  if (proposal.kind === 'edit') {
    let existing: { sys?: Record<string, unknown>; fields?: Record<string, unknown> };
    try {
      existing = await getFile(proposal.entryPath);
    } catch (err) {
      return {
        ok: false,
        error: `Could not read entry at ${proposal.entryPath}: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    if (!existing || !existing.sys) {
      return { ok: false, error: `Entry ${proposal.entryPath} not found.` };
    }
    const mergedFields = { ...existing.fields, ...proposal.fieldChanges };
    const payload = { sys: existing.sys, fields: mergedFields };
    const result = await saveFile(payload as Parameters<typeof saveFile>[0], proposal.entryPath);
    if (!result.success) {
      return {
        ok: false,
        error: result.error,
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      };
    }
    return { ok: true, entryPath: proposal.entryPath };
  }

  // kind === 'create'
  const created = await newFile(proposal.collection);
  if (!created.success) {
    return { ok: false, error: created.error };
  }
  let existing: { sys?: Record<string, unknown>; fields?: Record<string, unknown> };
  try {
    existing = await getFile(created.path);
  } catch (err) {
    return {
      ok: false,
      error: `Created entry but could not re-read it at ${created.path}: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const mergedFields = { ...existing.fields, ...proposal.fields };
  const payload = { sys: existing.sys, fields: mergedFields };
  const saved = await saveFile(payload as Parameters<typeof saveFile>[0], created.path);
  if (!saved.success) {
    return {
      ok: false,
      error: saved.error,
      ...(saved.fieldErrors ? { fieldErrors: saved.fieldErrors } : {}),
    };
  }
  return { ok: true, entryPath: created.path };
}

/**
 * Build a short human label for an edit proposal. Used for the chat card and
 * the model-facing tool result.
 */
export function describeEditSummary(
  collection: string,
  entryId: string,
  fieldChanges: Record<string, unknown>,
): string {
  const fields = Object.keys(fieldChanges);
  const list = fields.length > 3 ? `${fields.slice(0, 3).join(', ')}, +${fields.length - 3} more` : fields.join(', ');
  return `Edit ${collection} ${entryId}${list ? ` (${list})` : ''}`;
}

/** Build a short human label for a create proposal. */
export function describeCreateSummary(collection: string, fields: Record<string, unknown>): string {
  const fieldCount = Object.keys(fields).length;
  return `Create new ${collection} (${fieldCount} field${fieldCount === 1 ? '' : 's'} set)`;
}
