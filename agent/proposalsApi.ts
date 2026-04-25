/**
 * Route Handler implementations for the chat agent's stateless proposal
 * accept / reject endpoints. They live inside the package so user apps stay
 * thin: each route file is a one-line re-export plus a side-effect import of
 * the auto-generated `cms/__generated__/configInit`.
 *
 * `octocms init` (and `octocms update`) scaffold those re-export files —
 * see `octocms/cli/lib/templates.ts`.
 *
 * **Stateless by design.** No server-side proposal record is kept between the
 * SSE stream that emitted the proposal and this endpoint; the entire payload
 * arrives over the wire and is re-validated here. Vercel-safe.
 */
import { getServerSession } from 'next-auth/next';

import { authOptions } from '../admin/auth';
import { getAgentConfig } from './configStore';
import { isAgentEnabled } from './featureFlag';
import { acceptProposal, type Proposal } from './proposals';

function notFound(): Response {
  return new Response(null, { status: 404 });
}

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Validate that the deserialised body is a well-formed `Proposal`. We never
 * trust client-supplied JSON across the SSE → accept boundary; the caller
 * also re-runs schema validation (via `acceptProposal` → `saveFile`) before
 * any write.
 */
export function isProposal(p: unknown): p is Proposal {
  if (!p || typeof p !== 'object') return false;
  const obj = p as Record<string, unknown>;
  if (obj.kind !== 'edit' && obj.kind !== 'create') return false;
  if (typeof obj.collection !== 'string' || !obj.collection) return false;
  if (obj.kind === 'edit') {
    return typeof obj.entryPath === 'string' && !!obj.entryPath && typeof obj.fieldChanges === 'object' && obj.fieldChanges !== null;
  }
  return typeof obj.fields === 'object' && obj.fields !== null;
}

/**
 * `POST /api/agent/proposals/accept` — re-validates the proposal payload,
 * runs `acceptProposal` (which re-validates against the schema then calls
 * `saveFile` for edits, or `newFile` + `saveFile` for creates).
 *
 * Auth-gated. 404 when the agent feature is disabled.
 */
export async function acceptProposalRoute(request: Request): Promise<Response> {
  const agentConfig = getAgentConfig();
  if (!agentConfig || !isAgentEnabled(agentConfig)) return notFound();

  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Body must be JSON.');
  }
  const proposal = (body as { proposal?: unknown } | null)?.proposal;
  if (!isProposal(proposal)) {
    return badRequest('Body must be `{ proposal: { kind, collection, ... } }`.');
  }

  const result = await acceptProposal(proposal);
  if (!result.ok) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: result.error,
        ...(result.fieldErrors ? { fieldErrors: result.fieldErrors } : {}),
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(JSON.stringify({ ok: true, entryPath: result.entryPath }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * `POST /api/agent/proposals/reject` — there is no server-side proposal
 * record to mark rejected; this just acknowledges the click. The client
 * reflects rejection in its own state and feeds the rejection back to the
 * model on the next chat turn as a synthetic system note.
 *
 * Auth-gated to keep the endpoint shape consistent with `/accept` and to
 * avoid leaking the existence of the agent feature to unauthenticated callers.
 */
export async function rejectProposalRoute(request: Request): Promise<Response> {
  const agentConfig = getAgentConfig();
  if (!agentConfig || !isAgentEnabled(agentConfig)) return notFound();

  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  // Body is optional — typically `{ reason?: string }`. We accept anything
  // (even an empty body) and don't error out on parse failures.
  try {
    await request.json();
  } catch {
    /* empty / non-JSON body is fine */
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
