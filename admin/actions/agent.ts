'use server';

import './registerConfig';

import { getServerSession } from 'next-auth/next';

import { getAgentConfig } from '../../agent/configStore';
import { getAgentStatus, isAgentEnabled } from '../../agent/featureFlag';
import { acceptProposal, isProposal, type AcceptResult } from '../../agent/proposals';
import { authOptions } from '../auth';

export type AgentClientStatus =
  | { enabled: false }
  | {
      enabled: true;
      provider: 'anthropic' | 'openai' | 'local';
      model: string;
    };

/**
 * Server-side check exposed to the admin client (Header nav link).
 *
 * Never returns the API key. Returns `{ enabled: false }` when the chat API is
 * disabled (missing config, key, or budget). The `/cms/chat` page still renders
 * a setup guide; this action is for optional client UI that needs a boolean gate.
 */
export async function getAgentClientStatus(): Promise<AgentClientStatus> {
  const cfg = getAgentConfig();
  if (!cfg || !isAgentEnabled(cfg)) return { enabled: false };
  // Recompute via getAgentStatus so we exercise the same code path the route uses.
  const status = getAgentStatus(cfg);
  if (!status.enabled) return { enabled: false };
  return { enabled: true, provider: cfg.provider.type, model: cfg.provider.model };
}

export type AcceptProposalActionResult =
  | { ok: true; entryPath: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

/**
 * Server action — apply a chat-agent edit/create proposal.
 *
 * Replaces the previous `POST /api/agent/proposals/accept` Route Handler. The
 * client (`useChatStream`) calls this directly via the Server Action transport
 * — no public endpoint, no thin re-export file.
 *
 * Stateless by design: the entire proposal payload arrives over the wire and
 * is re-validated here (and again inside `acceptProposal` via the schema
 * validator + `saveFile`).
 *
 * Returns `{ ok: false, error }` on validation / write failures so the client
 * can render an inline error without try/catch around the action call.
 * Throws only when the agent is disabled or the caller is unauthenticated —
 * those are caller-bug shapes, not user-facing flow.
 */
export async function acceptProposalAction(proposal: unknown): Promise<AcceptProposalActionResult> {
  const cfg = getAgentConfig();
  if (!cfg || !isAgentEnabled(cfg)) {
    throw new Error('Chat agent is disabled.');
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Unauthorized.');
  }

  if (!isProposal(proposal)) {
    return { ok: false, error: 'Invalid proposal payload.' };
  }

  const result: AcceptResult = await acceptProposal(proposal);
  if (!result.ok) {
    return result.fieldErrors
      ? { ok: false, error: result.error, fieldErrors: result.fieldErrors }
      : { ok: false, error: result.error };
  }
  return { ok: true, entryPath: result.entryPath };
}

/**
 * Server action — record that the user dismissed a proposal.
 *
 * Replaces the previous `POST /api/agent/proposals/reject` Route Handler.
 * There's no server-side proposal record to mark rejected; this just
 * acknowledges the click. The client reflects rejection in its own state and
 * feeds the rejection back to the model on the next chat turn as a synthetic
 * system note. The `reason` argument is currently ignored — kept for forward
 * compatibility (e.g. analytics / per-rejection telemetry).
 *
 * Auth-gated to keep the surface consistent with `acceptProposalAction`.
 */
export async function rejectProposalAction(_reason?: string | null): Promise<{ ok: true }> {
  const cfg = getAgentConfig();
  if (!cfg || !isAgentEnabled(cfg)) {
    throw new Error('Chat agent is disabled.');
  }

  const session = await getServerSession(authOptions);
  if (!session) {
    throw new Error('Unauthorized.');
  }

  return { ok: true };
}
