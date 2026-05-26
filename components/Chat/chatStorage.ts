import type { NormalizedMessage } from '../../agent/providers/types';

import type { ChatEntry, ChatMeta, ProposalUiState, UsageSummary } from './types';

export const SESSIONS_STORAGE_KEY = 'octocms:chat-sessions';
export const ACTIVE_ID_STORAGE_KEY = 'octocms:chat-active-id';
export const MAX_CHAT_SESSIONS = 50;
export const TITLE_MAX_LEN = 48;
/** Debounce window used by `useChatHistory` before writing localStorage. */
export const PERSIST_DEBOUNCE_MS = 400;

export type PersistedChatStatus = 'idle' | 'error' | 'budget_exceeded' | 'stopped';

export type PersistedChatState = {
  entries: ChatEntry[];
  history: NormalizedMessage[];
  meta: ChatMeta | null;
  usage: UsageSummary;
  status: PersistedChatStatus;
  error: string | null;
  budgetReason: 'input_tokens' | 'output_tokens' | 'spend' | 'max_turns' | 'proposal_cap' | null;
  proposals: Record<string, ProposalUiState>;
};

export type StoredChatSession = {
  id: string;
  title: string;
  updatedAt: number;
  state: PersistedChatState;
};

export type ChatSessionListItem = {
  id: string;
  title: string;
  updatedAt: number;
};

type ChatSessionsFile = {
  version: 1;
  sessions: StoredChatSession[];
};

const EMPTY_FILE: ChatSessionsFile = { version: 1, sessions: [] };

export type StreamStateForPersist = {
  entries: ChatEntry[];
  history: NormalizedMessage[];
  meta: ChatMeta | null;
  usage: UsageSummary;
  status: 'idle' | 'streaming' | 'error' | 'budget_exceeded' | 'stopped';
  error: string | null;
  budgetReason: PersistedChatState['budgetReason'];
  proposals: Record<string, ProposalUiState>;
};

export function deriveTitle(entries: ChatEntry[]): string {
  const firstUser = entries.find((e) => e.kind === 'user');
  if (!firstUser || firstUser.kind !== 'user') return 'Untitled chat';
  const text = firstUser.text.trim();
  if (!text) return 'Untitled chat';
  if (text.length <= TITLE_MAX_LEN) return text;
  return `${text.slice(0, TITLE_MAX_LEN - 1)}…`;
}

export function toPersistedState(state: StreamStateForPersist): PersistedChatState | null {
  if (state.entries.length === 0 || state.status === 'streaming') return null;

  const entries = state.entries.map((e) => {
    if (e.kind !== 'assistant') return e;
    return { ...e, streaming: false };
  });

  const status = state.status as PersistedChatStatus;

  return {
    entries,
    history: state.history,
    meta: state.meta,
    usage: state.usage,
    status,
    error: state.error,
    budgetReason: state.budgetReason,
    proposals: state.proposals,
  };
}

export function trimSessions(sessions: StoredChatSession[], max: number = MAX_CHAT_SESSIONS): StoredChatSession[] {
  if (sessions.length <= max) return sessions;
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  return sorted.slice(0, max);
}

export function toSessionListItems(sessions: StoredChatSession[]): ChatSessionListItem[] {
  return [...sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

function parseSessionsFile(raw: string | null): ChatSessionsFile {
  if (!raw) return EMPTY_FILE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      (parsed as ChatSessionsFile).version !== 1 ||
      !Array.isArray((parsed as ChatSessionsFile).sessions)
    ) {
      return EMPTY_FILE;
    }
    return parsed as ChatSessionsFile;
  } catch {
    return EMPTY_FILE;
  }
}

export function readSessionsFile(): ChatSessionsFile {
  if (typeof window === 'undefined') return EMPTY_FILE;
  return parseSessionsFile(window.localStorage.getItem(SESSIONS_STORAGE_KEY));
}

export function writeSessionsFile(file: ChatSessionsFile): void {
  if (typeof window === 'undefined') return;
  let sessions = trimSessions(file.sessions);
  for (;;) {
    try {
      window.localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify({ version: 1, sessions }));
      return;
    } catch (err) {
      const isQuota = err instanceof DOMException && (err.name === 'QuotaExceededError' || err.code === 22);
      if (!isQuota || sessions.length === 0) return;
      sessions = sessions.slice(0, -1);
    }
  }
}

export function readActiveId(): string | null {
  if (typeof window === 'undefined') return null;
  const id = window.localStorage.getItem(ACTIVE_ID_STORAGE_KEY);
  return id && id.length > 0 ? id : null;
}

export function writeActiveId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id) window.localStorage.setItem(ACTIVE_ID_STORAGE_KEY, id);
    else window.localStorage.removeItem(ACTIVE_ID_STORAGE_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function getSession(id: string): StoredChatSession | null {
  const file = readSessionsFile();
  return file.sessions.find((s) => s.id === id) ?? null;
}

export function upsertSession(session: StoredChatSession): void {
  const file = readSessionsFile();
  const idx = file.sessions.findIndex((s) => s.id === session.id);
  const next = idx === -1 ? [...file.sessions, session] : file.sessions.map((s, i) => (i === idx ? session : s));
  writeSessionsFile({ version: 1, sessions: next });
}

export function removeStoredSession(id: string): void {
  const file = readSessionsFile();
  writeSessionsFile({ version: 1, sessions: file.sessions.filter((s) => s.id !== id) });
}

/** @deprecated Use `removeStoredSession` — kept as alias for older imports. */
export const deleteSession = removeStoredSession;

export function listSessionItems(): ChatSessionListItem[] {
  return toSessionListItems(readSessionsFile().sessions);
}

export function createSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** In-flight active id for this tab (avoids duplicate ids before localStorage write). */
let reservedActiveId: string | null = null;

export function getOrCreateActiveChatId(): string {
  const stored = readActiveId();
  if (stored) return stored;
  if (reservedActiveId) return reservedActiveId;
  const id = createSessionId();
  reservedActiveId = id;
  writeActiveId(id);
  return id;
}

export function setActiveChatId(id: string): void {
  reservedActiveId = id;
  writeActiveId(id);
}

export function clearReservedActiveChatId(): void {
  reservedActiveId = null;
}
