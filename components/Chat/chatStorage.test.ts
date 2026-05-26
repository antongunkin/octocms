import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_ID_STORAGE_KEY,
  deriveTitle,
  MAX_CHAT_SESSIONS,
  readActiveId,
  readSessionsFile,
  removeStoredSession,
  SESSIONS_STORAGE_KEY,
  toPersistedState,
  trimSessions,
  upsertSession,
  writeActiveId,
  writeSessionsFile,
  type PersistedChatState,
  type StoredChatSession,
} from './chatStorage';
import type { ChatEntry } from './types';

const baseState: PersistedChatState = {
  entries: [],
  history: [],
  meta: null,
  usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalCostUSD: 0 },
  status: 'idle',
  error: null,
  budgetReason: null,
  proposals: {},
};

function makeSession(id: string, updatedAt: number): StoredChatSession {
  return {
    id,
    title: `Chat ${id}`,
    updatedAt,
    state: {
      ...baseState,
      entries: [{ id: 'u1', kind: 'user', text: 'hello' }],
      history: [{ role: 'user', content: 'hello' }],
    },
  };
}

describe('chatStorage', () => {
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('round-trips sessions file', () => {
    const session = makeSession('a', 100);
    writeSessionsFile({ version: 1, sessions: [session] });
    expect(readSessionsFile().sessions).toHaveLength(1);
    expect(readSessionsFile().sessions[0].id).toBe('a');
  });

  it('returns empty file for invalid JSON', () => {
    store.set(SESSIONS_STORAGE_KEY, 'not-json');
    expect(readSessionsFile().sessions).toEqual([]);
  });

  it('deriveTitle uses first user message with ellipsis', () => {
    const entries: ChatEntry[] = [
      { id: '1', kind: 'user', text: 'short' },
      { id: '2', kind: 'assistant', text: '', toolCalls: [], proposalIds: [], streaming: false },
    ];
    expect(deriveTitle(entries)).toBe('short');
    const long = 'x'.repeat(60);
    expect(deriveTitle([{ id: '1', kind: 'user', text: long }])).toMatch(/…$/);
    expect(deriveTitle([])).toBe('Untitled chat');
  });

  it('trimSessions keeps newest by updatedAt', () => {
    const sessions = [makeSession('old', 1), makeSession('mid', 2), makeSession('new', 3)];
    const trimmed = trimSessions(sessions, 2);
    expect(trimmed.map((s) => s.id).sort()).toEqual(['mid', 'new']);
  });

  it('toPersistedState returns null when empty or streaming', () => {
    expect(
      toPersistedState({
        ...baseState,
        entries: [],
        status: 'idle',
        proposals: {},
      }),
    ).toBeNull();
    expect(
      toPersistedState({
        ...baseState,
        entries: [{ id: 'u', kind: 'user', text: 'hi' }],
        status: 'streaming',
        proposals: {},
      }),
    ).toBeNull();
  });

  it('toPersistedState clears assistant streaming flag', () => {
    const snap = toPersistedState({
      ...baseState,
      entries: [
        { id: 'u', kind: 'user', text: 'hi' },
        { id: 'a', kind: 'assistant', text: 'partial', toolCalls: [], proposalIds: [], streaming: true },
      ],
      status: 'stopped',
      proposals: {},
    });
    expect(snap?.entries[1]).toMatchObject({ kind: 'assistant', streaming: false });
  });

  it('removeStoredSession deletes by id', () => {
    upsertSession(makeSession('del-me', 1));
    removeStoredSession('del-me');
    expect(readSessionsFile().sessions).toHaveLength(0);
  });

  it('upsertSession replaces by id', () => {
    upsertSession(makeSession('x', 1));
    upsertSession({ ...makeSession('x', 2), title: 'Updated' });
    expect(readSessionsFile().sessions[0].title).toBe('Updated');
    expect(readSessionsFile().sessions[0].updatedAt).toBe(2);
  });

  it('writeActiveId round-trips', () => {
    writeActiveId('sess-1');
    expect(readActiveId()).toBe('sess-1');
    writeActiveId(null);
    expect(readActiveId()).toBeNull();
    expect(store.has(ACTIVE_ID_STORAGE_KEY)).toBe(false);
  });

  it('drops oldest sessions on QuotaExceededError', () => {
    let calls = 0;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        calls += 1;
        if (calls === 1 && key === SESSIONS_STORAGE_KEY) {
          const err = new DOMException('quota', 'QuotaExceededError');
          throw err;
        }
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    const many = Array.from({ length: 3 }, (_, i) => makeSession(`s${i}`, i));
    writeSessionsFile({ version: 1, sessions: many });
    expect(readSessionsFile().sessions.length).toBeLessThan(3);
  });

  it('trimSessions respects MAX_CHAT_SESSIONS default', () => {
    const sessions = Array.from({ length: MAX_CHAT_SESSIONS + 5 }, (_, i) => makeSession(`id${i}`, i));
    expect(trimSessions(sessions).length).toBe(MAX_CHAT_SESSIONS);
  });
});
