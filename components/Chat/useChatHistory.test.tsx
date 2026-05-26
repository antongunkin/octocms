import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ACTIVE_ID_STORAGE_KEY,
  clearReservedActiveChatId,
  PERSIST_DEBOUNCE_MS,
  SESSIONS_STORAGE_KEY,
} from './chatStorage';
import { useChatHistory } from './useChatHistory';
import { withQuery } from '../../admin/query/test/renderWithQuery';

/** Wait for debounced localStorage writes after stream settles. */
async function flushPersist() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 50));
  });
}

function makeSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

describe('useChatHistory', () => {
  const store = new Map<string, string>();
  let originalFetch: typeof globalThis.fetch;
  let unmountHook: (() => void) | undefined;
  const { Wrapper } = withQuery();

  beforeEach(() => {
    store.clear();
    clearReservedActiveChatId();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
    });
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      return new Response(makeSseStream(['data: {"type":"text_delta","text":"Hi"}\n\n', 'data: {"type":"done"}\n\n']), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof globalThis.fetch;
  });

  afterEach(async () => {
    unmountHook?.();
    unmountHook = undefined;
    await act(async () => {
      await new Promise((r) => setTimeout(r, PERSIST_DEBOUNCE_MS + 50));
    });
    store.clear();
    globalThis.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('creates a listed session after first send', async () => {
    const { result, unmount } = renderHook(() => useChatHistory(), { wrapper: Wrapper });
    unmountHook = unmount;
    expect(result.current.sessions).toHaveLength(0);

    await act(async () => {
      await result.current.send('first message');
    });

    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(1));
    expect(result.current.sessions[0].title).toBe('first message');
    expect(store.get(SESSIONS_STORAGE_KEY)).toContain('first message');
  });

  it('newConversation does not list until send', async () => {
    const { result, unmount } = renderHook(() => useChatHistory(), { wrapper: Wrapper });
    unmountHook = unmount;

    await act(async () => {
      await result.current.send('one');
    });
    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(1));

    act(() => {
      result.current.newConversation();
    });
    expect(result.current.entries).toHaveLength(0);
    expect(result.current.sessions.length).toBe(1);

    await act(async () => {
      await result.current.send('two');
    });
    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(2));
  });

  it('selectSession hydrates a different transcript', async () => {
    const { result, unmount } = renderHook(() => useChatHistory(), { wrapper: Wrapper });
    unmountHook = unmount;

    await act(async () => {
      await result.current.send('chat A');
    });
    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(1));
    const idA = result.current.sessions[0].id;

    act(() => {
      result.current.newConversation();
    });
    await act(async () => {
      await result.current.send('chat B');
    });
    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(2));

    act(() => {
      result.current.selectSession(idA);
    });
    expect(result.current.entries.some((e) => e.kind === 'user' && e.text === 'chat A')).toBe(true);
    expect(result.current.activeId).toBe(idA);
  });

  it('deleteSession removes from list and switches active', async () => {
    const { result, unmount } = renderHook(() => useChatHistory(), { wrapper: Wrapper });
    unmountHook = unmount;

    await act(async () => {
      await result.current.send('only chat');
    });
    await flushPersist();
    await waitFor(() => expect(result.current.sessions.length).toBe(1));
    const id = result.current.sessions[0].id;
    expect(result.current.activeId).toBe(id);
    const beforeDelete = JSON.parse(store.get(SESSIONS_STORAGE_KEY)!);
    expect(beforeDelete.sessions).toHaveLength(1);
    expect(beforeDelete.sessions[0].id).toBe(id);

    act(() => {
      result.current.deleteSession(id);
    });
    const stored = JSON.parse(store.get(SESSIONS_STORAGE_KEY) ?? '{"version":1,"sessions":[]}');
    expect(stored.sessions).toHaveLength(0);
    await waitFor(() => expect(result.current.sessions.length).toBe(0));
    expect(result.current.entries).toHaveLength(0);
    expect(store.get(ACTIVE_ID_STORAGE_KEY)).toBeTruthy();
  });

  it('hydrates from localStorage on mount', async () => {
    const sessionId = 'saved-id-123';
    const file = {
      version: 1 as const,
      sessions: [
        {
          id: sessionId,
          title: 'Restored',
          updatedAt: Date.now(),
          state: {
            entries: [{ id: 'u1', kind: 'user' as const, text: 'Restored' }],
            history: [{ role: 'user' as const, content: 'Restored' }],
            meta: null,
            usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, totalCostUSD: 0 },
            status: 'idle' as const,
            error: null,
            budgetReason: null,
            proposals: {},
          },
        },
      ],
    };
    store.set(SESSIONS_STORAGE_KEY, JSON.stringify(file));
    store.set(ACTIVE_ID_STORAGE_KEY, sessionId);

    const { result, unmount } = renderHook(() => useChatHistory(), { wrapper: Wrapper });
    unmountHook = unmount;
    await waitFor(() => expect(result.current.entries.length).toBe(1));
    expect(result.current.entries[0]).toMatchObject({ text: 'Restored' });
    expect(result.current.sessions[0].id).toBe(sessionId);
  });
});
