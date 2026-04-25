'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';

import type { AttachmentDiagnostic } from '../../agent/attachments';
import type { ChatEvent } from '../../agent/chat';
import type { NormalizedMessage } from '../../agent/providers/types';
import type { Proposal } from '../../agent/proposals';

import type { ChatEntry, ChatMeta, ChatToolCall, ProposalStatus, ProposalUiState, UsageSummary } from './types';

type State = {
  entries: ChatEntry[];
  /** Wire history — what we send back to the server on the next request. */
  history: NormalizedMessage[];
  meta: ChatMeta | null;
  usage: UsageSummary;
  status: 'idle' | 'streaming' | 'error' | 'budget_exceeded' | 'stopped';
  error: string | null;
  /** Reason for budget_exceeded if any. */
  budgetReason: 'input_tokens' | 'output_tokens' | 'spend' | 'max_turns' | 'proposal_cap' | null;
  /** All proposals seen this conversation, keyed by `proposal.id`. */
  proposals: Record<string, ProposalUiState>;
  /** Latest attachment outcomes — replaced (not accumulated) on each turn. */
  attachmentDiagnostics: AttachmentDiagnostic[];
};

type Action =
  | { type: 'reset' }
  | {
      type: 'submit';
      userText: string;
      entryId: string;
      assistantId: string;
      /** Filenames of attachments shown inline on the user bubble. */
      attachmentNames?: string[];
    }
  | { type: 'submit_system'; text: string; entryId: string; assistantId: string; wireText: string }
  | { type: 'meta'; meta: ChatMeta }
  | { type: 'attachments'; diagnostics: AttachmentDiagnostic[] }
  | { type: 'event'; assistantId: string; event: ChatEvent }
  | { type: 'finish'; assistantId: string; appendedHistory: NormalizedMessage[] }
  | { type: 'errored'; message: string }
  | { type: 'stopped'; assistantId: string }
  | { type: 'proposal_status'; proposalId: string; status: ProposalStatus };

const ZERO_USAGE: UsageSummary = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalCostUSD: 0 };

const initial: State = {
  entries: [],
  history: [],
  meta: null,
  usage: ZERO_USAGE,
  status: 'idle',
  error: null,
  budgetReason: null,
  proposals: {},
  attachmentDiagnostics: [],
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return { ...initial, meta: state.meta };
    case 'submit': {
      const userEntry: ChatEntry = {
        id: action.entryId,
        kind: 'user',
        text: action.userText,
        ...(action.attachmentNames && action.attachmentNames.length > 0
          ? { attachmentNames: action.attachmentNames }
          : {}),
      };
      const assistantEntry: ChatEntry = {
        id: action.assistantId,
        kind: 'assistant',
        text: '',
        toolCalls: [],
        proposalIds: [],
        streaming: true,
      };
      return {
        ...state,
        status: 'streaming',
        error: null,
        budgetReason: null,
        attachmentDiagnostics: [],
        entries: [...state.entries, userEntry, assistantEntry],
        history: [...state.history, { role: 'user', content: action.userText }],
      };
    }
    case 'attachments':
      return { ...state, attachmentDiagnostics: action.diagnostics };
    case 'submit_system': {
      const systemEntry: ChatEntry = { id: action.entryId, kind: 'system', text: action.text };
      const assistantEntry: ChatEntry = {
        id: action.assistantId,
        kind: 'assistant',
        text: '',
        toolCalls: [],
        proposalIds: [],
        streaming: true,
      };
      return {
        ...state,
        status: 'streaming',
        error: null,
        budgetReason: null,
        entries: [...state.entries, systemEntry, assistantEntry],
        history: [...state.history, { role: 'user', content: action.wireText }],
      };
    }
    case 'meta':
      return { ...state, meta: action.meta };
    case 'event':
      return applyEvent(state, action.assistantId, action.event);
    case 'finish':
      return {
        ...state,
        status: state.status === 'streaming' ? 'idle' : state.status,
        history: [...state.history, ...action.appendedHistory],
        entries: state.entries.map((e) =>
          e.id === action.assistantId && e.kind === 'assistant' ? { ...e, streaming: false } : e,
        ),
      };
    case 'errored':
      return { ...state, status: 'error', error: action.message };
    case 'stopped':
      return {
        ...state,
        status: 'stopped',
        entries: state.entries.map((e) =>
          e.id === action.assistantId && e.kind === 'assistant' ? { ...e, streaming: false } : e,
        ),
      };
    case 'proposal_status': {
      const existing = state.proposals[action.proposalId];
      if (!existing) return state;
      return {
        ...state,
        proposals: {
          ...state.proposals,
          [action.proposalId]: { ...existing, status: action.status },
        },
      };
    }
  }
}

function applyEvent(state: State, assistantId: string, event: ChatEvent): State {
  const entries = [...state.entries];
  const idx = entries.findIndex((e) => e.id === assistantId && e.kind === 'assistant');
  if (idx === -1) return state;
  const current = entries[idx] as Extract<ChatEntry, { kind: 'assistant' }>;
  let next = current;

  switch (event.type) {
    case 'text_delta':
      next = { ...current, text: current.text + event.text };
      break;
    case 'tool_use_start': {
      const tc: ChatToolCall = { id: event.id, name: event.name, inputJson: '' };
      next = { ...current, toolCalls: [...current.toolCalls, tc] };
      break;
    }
    case 'tool_use_input_delta': {
      next = {
        ...current,
        toolCalls: current.toolCalls.map((tc) =>
          tc.id === event.id ? { ...tc, inputJson: tc.inputJson + event.partialJson } : tc,
        ),
      };
      break;
    }
    case 'tool_use_complete': {
      next = {
        ...current,
        toolCalls: current.toolCalls.map((tc) =>
          tc.id === event.id ? { ...tc, parsedInput: event.input } : tc,
        ),
      };
      break;
    }
    case 'tool_result': {
      next = {
        ...current,
        toolCalls: current.toolCalls.map((tc) =>
          tc.id === event.toolUseId
            ? { ...tc, result: { content: event.result, isError: Boolean(event.isError) } }
            : tc,
        ),
      };
      break;
    }
    case 'proposal': {
      next = { ...current, proposalIds: [...current.proposalIds, event.proposal.id] };
      entries[idx] = next;
      const proposalState: ProposalUiState = {
        proposal: event.proposal,
        assistantEntryId: assistantId,
        status: { kind: 'pending' },
      };
      return {
        ...state,
        entries,
        proposals: { ...state.proposals, [event.proposal.id]: proposalState },
      };
    }
    case 'usage': {
      const usage: UsageSummary = {
        inputTokens: state.usage.inputTokens + event.inputTokens,
        outputTokens: state.usage.outputTokens + event.outputTokens,
        cachedInputTokens: state.usage.cachedInputTokens + (event.cachedInputTokens ?? 0),
        totalCostUSD: event.totalCostUSD,
      };
      entries[idx] = current;
      return { ...state, entries, usage };
    }
    case 'budget_exceeded':
      return { ...state, status: 'budget_exceeded', budgetReason: event.reason };
    case 'error':
      return { ...state, status: 'error', error: event.message };
    case 'turn_stop':
    case 'done':
      // Note: full assistant content (text + tool calls + tool results) is folded
      // back into history when the SSE stream completes — see `finalizeHistory`.
      break;
  }

  entries[idx] = next;
  return { ...state, entries };
}

/** Build the new history slice (assistant + tool messages) from the assistant entry. */
function buildAppendedHistory(state: State, assistantId: string): NormalizedMessage[] {
  const entry = state.entries.find((e) => e.id === assistantId && e.kind === 'assistant');
  if (!entry || entry.kind !== 'assistant') return [];
  const blocks: import('../../agent/providers/types').NormalizedContentBlock[] = [];
  if (entry.text) blocks.push({ type: 'text', text: entry.text });
  for (const tc of entry.toolCalls) {
    blocks.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.parsedInput ?? {} });
  }
  const out: NormalizedMessage[] = [{ role: 'assistant', content: blocks }];
  for (const tc of entry.toolCalls) {
    if (tc.result) {
      out.push({
        role: 'tool',
        toolUseId: tc.id,
        content: tc.result.content,
        ...(tc.result.isError ? { isError: true } : {}),
      });
    }
  }
  return out;
}

export type UseChatStreamReturn = {
  entries: ChatEntry[];
  meta: ChatMeta | null;
  usage: UsageSummary;
  status: State['status'];
  error: string | null;
  budgetReason: State['budgetReason'];
  proposals: Record<string, ProposalUiState>;
  attachmentDiagnostics: AttachmentDiagnostic[];
  send(text: string, files?: File[]): Promise<void>;
  reset(): void;
  /**
   * Abort the in-flight chat request. The streamed-so-far assistant content
   * is kept in the transcript and folded into history (so the next turn sees
   * a coherent conversation); status flips to `'stopped'` until the next
   * `send`. No-op when nothing is streaming.
   */
  stop(): void;
  acceptProposal(proposalId: string): Promise<void>;
  rejectProposal(proposalId: string, reason?: string): Promise<void>;
  acceptAllPending(assistantEntryId: string): Promise<void>;
};

export function useChatStream(endpoint: string = '/api/agent'): UseChatStreamReturn {
  const [state, dispatch] = useReducer(reducer, initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  /**
   * Holds the in-flight request controller + the assistant-entry id it
   * belongs to. `stop()` aborts the controller and finalises that entry.
   * Set on submit, cleared on completion or abort.
   */
  const inFlightRef = useRef<{ controller: AbortController; assistantId: string } | null>(null);

  const reset = useCallback(() => {
    // Cancel any in-flight stream so a "New conversation" click really starts fresh.
    if (inFlightRef.current) {
      inFlightRef.current.controller.abort();
      inFlightRef.current = null;
    }
    dispatch({ type: 'reset' });
  }, []);

  // Abort any pending stream when the hook unmounts (page navigation, etc.)
  // so we don't leak the connection.
  useEffect(() => {
    return () => {
      inFlightRef.current?.controller.abort();
      inFlightRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    const inFlight = inFlightRef.current;
    if (!inFlight) return;
    inFlight.controller.abort();
    inFlightRef.current = null;
    // Persist whatever assistant content we've already streamed back into history
    // so the next turn sees a coherent transcript, then mark the entry stopped.
    const appendedHistory = buildAppendedHistory(stateRef.current, inFlight.assistantId);
    if (appendedHistory.length > 0) {
      dispatch({ type: 'finish', assistantId: inFlight.assistantId, appendedHistory });
    }
    dispatch({ type: 'stopped', assistantId: inFlight.assistantId });
  }, []);

  /**
   * Run the streaming chat request. Used by `send` (user messages) and
   * `submitSystemMessage` (auto-followup after accept/reject).
   *
   * When `files` is non-empty, sends the request as multipart/form-data so the
   * server can parse uploads. Otherwise sends JSON. Either way, history is
   * always serialised in the `messages` field.
   */
  const runRequest = useCallback(
    async (assistantId: string, historyToSend: NormalizedMessage[], files?: File[]) => {
      const controller = new AbortController();
      inFlightRef.current = { controller, assistantId };
      try {
        const init: RequestInit =
          files && files.length > 0
            ? {
                method: 'POST',
                body: buildMultipartBody(historyToSend, files),
                signal: controller.signal,
              }
            : {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: historyToSend }),
                signal: controller.signal,
              };
        const res = await fetch(endpoint, init);
        if (!res.ok) {
          const message = res.status === 404 ? 'Chat is not enabled in this deploy.' : `HTTP ${res.status}`;
          dispatch({ type: 'errored', message });
          return;
        }
        if (!res.body) {
          dispatch({ type: 'errored', message: 'Server returned an empty body.' });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE blocks separated by \n\n. Each may be `event: meta` or `data:`.
          let sepIdx;
          while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
            const block = buffer.slice(0, sepIdx);
            buffer = buffer.slice(sepIdx + 2);
            handleSseBlock(block, assistantId, dispatch);
          }
        }
      } catch (err) {
        // AbortError (from `stop()` / `reset()` / unmount) is expected — `stop`
        // already dispatched its own state transition, so swallow it here.
        const aborted =
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.name === 'AbortError') ||
          controller.signal.aborted;
        if (aborted) return;
        dispatch({ type: 'errored', message: err instanceof Error ? err.message : 'Network error' });
        return;
      } finally {
        // Clear in-flight only if it's still pointing at *this* request.
        if (inFlightRef.current?.controller === controller) {
          inFlightRef.current = null;
        }
      }

      const appendedHistory = buildAppendedHistory(stateRef.current, assistantId);
      dispatch({ type: 'finish', assistantId, appendedHistory });
    },
    [endpoint],
  );

  const send = useCallback(
    async (text: string, files: File[] = []) => {
      const trimmed = text.trim();
      // Allow empty text when there are attachments — the model can still
      // reason about the document. Default the wire prompt so the model has
      // something to anchor on.
      const wireText = trimmed || (files.length > 0 ? 'Please review the attached document.' : '');
      if (!wireText || stateRef.current.status === 'streaming') return;
      const entryId = `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const assistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      dispatch({
        type: 'submit',
        userText: trimmed,
        entryId,
        assistantId,
        ...(files.length > 0 ? { attachmentNames: files.map((f) => f.name) } : {}),
      });

      // Build the request body from the SAME state we're dispatching into,
      // so the server sees the full history including the new user message.
      const historyToSend: NormalizedMessage[] = [
        ...stateRef.current.history,
        { role: 'user', content: wireText },
      ];

      await runRequest(assistantId, historyToSend, files);
    },
    [runRequest],
  );

  /**
   * Internal: post a synthetic system-style message to continue the conversation
   * after the user accepts or rejects a proposal. The entry shows in the
   * transcript as a `system` bubble (no avatar); on the wire it's a `user`
   * message tagged `[System notification]` so the model picks it up.
   */
  const submitSystemMessage = useCallback(
    async (visibleText: string, wireText: string) => {
      if (stateRef.current.status === 'streaming') return;
      const entryId = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const assistantId = `a_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      dispatch({ type: 'submit_system', text: visibleText, entryId, assistantId, wireText });

      const historyToSend: NormalizedMessage[] = [
        ...stateRef.current.history,
        { role: 'user', content: wireText },
      ];
      await runRequest(assistantId, historyToSend);
    },
    [runRequest],
  );

  const acceptProposal = useCallback(
    async (proposalId: string) => {
      const ps = stateRef.current.proposals[proposalId];
      if (!ps || ps.status.kind !== 'pending') return;

      dispatch({ type: 'proposal_status', proposalId, status: { kind: 'accepting' } });
      let res: Response;
      try {
        res = await fetch('/api/agent/proposals/accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ proposal: ps.proposal }),
        });
      } catch (err) {
        dispatch({
          type: 'proposal_status',
          proposalId,
          status: { kind: 'error', message: err instanceof Error ? err.message : 'Network error' },
        });
        return;
      }

      let body: { ok?: boolean; entryPath?: string; error?: string; fieldErrors?: Record<string, string> } = {};
      try {
        body = await res.json();
      } catch {
        /* keep empty */
      }

      if (!res.ok || !body.ok || !body.entryPath) {
        dispatch({
          type: 'proposal_status',
          proposalId,
          status: {
            kind: 'error',
            message: body.error || `Accept failed (HTTP ${res.status})`,
            ...(body.fieldErrors ? { fieldErrors: body.fieldErrors } : {}),
          },
        });
        return;
      }
      dispatch({
        type: 'proposal_status',
        proposalId,
        status: { kind: 'accepted', entryPath: body.entryPath },
      });

      // Auto-followup so the model sees the result and can continue naturally.
      await submitSystemMessage(
        `Accepted: ${ps.proposal.summary} → saved at ${body.entryPath}.`,
        `[System notification] The user ACCEPTED proposal ${ps.proposal.id} (${ps.proposal.summary}). The entry was saved at ${body.entryPath}. Continue the conversation — do NOT propose the same change again.`,
      );
    },
    [submitSystemMessage],
  );

  const rejectProposal = useCallback(
    async (proposalId: string, reason?: string) => {
      const ps = stateRef.current.proposals[proposalId];
      if (!ps || ps.status.kind !== 'pending') return;

      dispatch({ type: 'proposal_status', proposalId, status: { kind: 'rejecting' } });
      try {
        await fetch('/api/agent/proposals/reject', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason ?? null }),
        });
      } catch {
        /* reject is informational; still mark rejected even if endpoint failed */
      }
      dispatch({
        type: 'proposal_status',
        proposalId,
        status: { kind: 'rejected', ...(reason ? { reason } : {}) },
      });

      const reasonClause = reason ? ` Reason: ${reason}` : '';
      await submitSystemMessage(
        `Rejected: ${ps.proposal.summary}.${reasonClause}`,
        `[System notification] The user REJECTED proposal ${ps.proposal.id} (${ps.proposal.summary}).${reasonClause} Acknowledge briefly and ask if they want a different change — do NOT re-propose the same thing.`,
      );
    },
    [submitSystemMessage],
  );

  const acceptAllPending = useCallback(
    async (assistantEntryId: string) => {
      // Snapshot the pending proposals on this assistant turn at click time.
      const all = Object.values(stateRef.current.proposals).filter(
        (p) => p.assistantEntryId === assistantEntryId && p.status.kind === 'pending',
      );
      for (const p of all) {
        // After each accept, the auto-followup triggers a fresh assistant turn.
        // We wait for it to finish before accepting the next so we don't race.
        await acceptProposal(p.proposal.id);
        // Halt on first failure — matches the Phase 4 plan's "halt on first failure".
        const updated = stateRef.current.proposals[p.proposal.id];
        if (!updated || updated.status.kind !== 'accepted') break;
      }
    },
    [acceptProposal],
  );

  return {
    entries: state.entries,
    meta: state.meta,
    usage: state.usage,
    status: state.status,
    error: state.error,
    budgetReason: state.budgetReason,
    proposals: state.proposals,
    attachmentDiagnostics: state.attachmentDiagnostics,
    send,
    reset,
    stop,
    acceptProposal,
    rejectProposal,
    acceptAllPending,
  };
}

/**
 * Build a multipart FormData body. The chat history is JSON-serialised into
 * a `messages` field; uploads go in repeated `files` fields. The server-side
 * route handler (`src/app/api/agent/route.ts`) parses the same shape.
 */
function buildMultipartBody(messages: NormalizedMessage[], files: File[]): FormData {
  const fd = new FormData();
  fd.append('messages', JSON.stringify(messages));
  for (const f of files) fd.append('files', f, f.name);
  return fd;
}

function handleSseBlock(block: string, assistantId: string, dispatch: (a: Action) => void): void {
  // SSE block: lines starting with `event:` or `data:`.
  const lines = block.split('\n');
  let eventName: string | null = null;
  const dataLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return;
  const payload = dataLines.join('\n');
  try {
    const json = JSON.parse(payload);
    if (eventName === 'meta') {
      dispatch({ type: 'meta', meta: json as ChatMeta });
      return;
    }
    if (eventName === 'attachments') {
      const diagnostics = (json as { diagnostics?: AttachmentDiagnostic[] }).diagnostics ?? [];
      dispatch({ type: 'attachments', diagnostics });
      return;
    }
    dispatch({ type: 'event', assistantId, event: json as ChatEvent });
  } catch {
    // Ignore malformed chunks — stream continues.
  }
}

// Re-export so consumers don't need to also reach into ./types
export type { Proposal };
