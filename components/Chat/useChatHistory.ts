'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import {
  clearReservedActiveChatId,
  createSessionId,
  removeStoredSession,
  deriveTitle,
  getOrCreateActiveChatId,
  getSession,
  listSessionItems,
  PERSIST_DEBOUNCE_MS,
  readActiveId,
  SESSIONS_STORAGE_KEY,
  setActiveChatId,
  upsertSession,
  writeActiveId,
  type ChatSessionListItem,
  type PersistedChatState,
  type StoredChatSession,
} from './chatStorage';
import { useChatStream, type UseChatStreamReturn } from './useChatStream';

/** One debounced writer per tab — avoids duplicate sessions under React Strict Mode. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let persistSuspended = 0;

function cancelScheduledPersist(): void {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
}

function schedulePersist(fn: () => void): void {
  cancelScheduledPersist();
  persistTimer = setTimeout(() => {
    persistTimer = null;
    fn();
  }, PERSIST_DEBOUNCE_MS);
}

export type UseChatHistoryReturn = UseChatStreamReturn & {
  sessions: ChatSessionListItem[];
  activeId: string | null;
  newConversation: () => void;
  selectSession: (id: string) => void;
  deleteSession: (id: string) => void;
};

function refreshSessionsList(): ChatSessionListItem[] {
  return listSessionItems();
}

export function useChatHistory(endpoint?: string): UseChatHistoryReturn {
  const stream = useChatStream(endpoint);
  const [sessions, setSessions] = useState<ChatSessionListItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  activeIdRef.current = activeId;

  const ensureActiveId = useCallback((): string => {
    if (activeIdRef.current) return activeIdRef.current;
    const id = getOrCreateActiveChatId();
    activeIdRef.current = id;
    setActiveId(id);
    return id;
  }, []);

  const persistNow = useCallback(() => {
    if (persistSuspended > 0) return;
    const id = readActiveId() ?? activeIdRef.current;
    if (!id) return;
    const snapshot = stream.getSnapshot();
    if (!snapshot) return;
    const existing = getSession(id);
    const title = existing?.title ?? deriveTitle(snapshot.entries);
    const session: StoredChatSession = {
      id,
      title,
      updatedAt: Date.now(),
      state: snapshot,
    };
    upsertSession(session);
    setSessions(refreshSessionsList());
  }, [stream]);

  const schedulePersistCallback = useCallback(() => {
    schedulePersist(persistNow);
  }, [persistNow]);

  // Initial load from localStorage
  useEffect(() => {
    setSessions(refreshSessionsList());
    const storedActive = readActiveId();
    if (storedActive) {
      const stored = getSession(storedActive);
      if (stored) {
        activeIdRef.current = storedActive;
        setActiveId(storedActive);
        stream.hydrate(stored.state);
      } else {
        writeActiveId(null);
      }
    }
    mountedRef.current = true;
    return () => {
      cancelScheduledPersist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only hydrate
  }, []);

  // Debounced persist when conversation state settles
  useEffect(() => {
    if (!mountedRef.current) return;
    if (stream.status === 'streaming') return;
    if (stream.entries.length === 0) return;
    ensureActiveId();
    schedulePersistCallback();
  }, [
    stream.entries,
    stream.history,
    stream.status,
    stream.proposals,
    stream.usage,
    stream.error,
    stream.budgetReason,
    ensureActiveId,
    schedulePersistCallback,
  ]);

  // Cross-tab session list refresh
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SESSIONS_STORAGE_KEY) setSessions(refreshSessionsList());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const newConversation = useCallback(() => {
    cancelScheduledPersist();
    persistNow();
    stream.reset();
    clearReservedActiveChatId();
    const id = createSessionId();
    setActiveChatId(id);
    activeIdRef.current = id;
    setActiveId(id);
  }, [stream, persistNow]);

  const selectSession = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) return;
      cancelScheduledPersist();
      persistNow();
      const stored = getSession(id);
      if (!stored) return;
      stream.hydrate(stored.state);
      setActiveChatId(id);
      activeIdRef.current = id;
      setActiveId(id);
    },
    [stream, persistNow],
  );

  const deleteSession = useCallback(
    (id: string) => {
      persistSuspended += 1;
      cancelScheduledPersist();
      const active = activeIdRef.current ?? readActiveId();
      const wasActive = active === id;
      removeStoredSession(id);
      if (wasActive) {
        stream.reset();
      }
      const nextList = refreshSessionsList();
      if (wasActive) {
        if (nextList.length > 0) {
          const newest = nextList[0];
          const stored = getSession(newest.id);
          if (stored) {
            stream.hydrate(stored.state);
            setActiveChatId(newest.id);
            activeIdRef.current = newest.id;
            setActiveId(newest.id);
          }
        } else {
          clearReservedActiveChatId();
          const newId = createSessionId();
          setActiveChatId(newId);
          activeIdRef.current = newId;
          setActiveId(newId);
        }
      }
      setSessions(refreshSessionsList());
      persistSuspended -= 1;
    },
    [stream],
  );

  const send = useCallback(
    async (text: string, files?: File[]) => {
      ensureActiveId();
      await stream.send(text, files);
    },
    [stream, ensureActiveId],
  );

  return {
    ...stream,
    send,
    sessions,
    activeId,
    newConversation,
    selectSession,
    deleteSession,
  };
}

export type { PersistedChatState };
