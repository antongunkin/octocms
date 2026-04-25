/**
 * Wire-format types shared between the chat client and `/api/agent`.
 *
 * Mirrors `octocms/agent` shapes so the API contract stays one source of
 * truth — when the engine adds an event, both ends pick it up automatically.
 */
export type { NormalizedMessage, NormalizedContentBlock } from '../../agent/providers/types';
export type { ChatEvent } from '../../agent/chat';
export type { StyleExemplar } from '../../agent/systemPrompt';
export type { Proposal, EditProposal, CreateProposal } from '../../agent/proposals';

/** Internal id for a transcript entry — distinct from `tool_use_id`. */
export type ChatEntryId = string;

/** A logical block in the transcript. */
export type ChatEntry =
  | {
      id: ChatEntryId;
      kind: 'user';
      text: string;
      /** Phase 5 — names of attachments included with this turn (display only). */
      attachmentNames?: string[];
    }
  | {
      id: ChatEntryId;
      kind: 'assistant';
      /** Streaming text — concatenated as deltas arrive. */
      text: string;
      /** Tool calls the assistant made in this turn. */
      toolCalls: ChatToolCall[];
      /** Proposal ids emitted by tool calls in this assistant turn. Cards render inline. */
      proposalIds: string[];
      /** True until `done`. */
      streaming: boolean;
    }
  | { id: ChatEntryId; kind: 'system'; text: string };

export type ChatToolCall = {
  id: string;
  name: string;
  inputJson: string;
  parsedInput?: unknown;
  result?: { content: string; isError: boolean };
};

export type ChatMeta = {
  provider: 'anthropic' | 'openai' | 'local';
  model: string;
};

export type UsageSummary = {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  totalCostUSD: number;
};

/** Status of a single proposal as the user works through it. */
export type ProposalStatus =
  | { kind: 'pending' }
  | { kind: 'accepting' }
  | { kind: 'accepted'; entryPath: string }
  | { kind: 'rejecting' }
  | { kind: 'rejected'; reason?: string }
  | { kind: 'error'; message: string; fieldErrors?: Record<string, string> };

/** UI-side state for a proposal — the proposal payload + its current status. */
export type ProposalUiState = {
  proposal: import('../../agent/proposals').Proposal;
  /** ChatEntry id this proposal belongs to (for inline rendering). */
  assistantEntryId: string;
  status: ProposalStatus;
};
