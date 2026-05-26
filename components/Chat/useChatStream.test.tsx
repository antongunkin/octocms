import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { acceptProposalAction, rejectProposalAction } from '../../admin/actions/agent';
import { queryKeys } from '../../admin/query/keys';
import { withQuery } from '../../admin/query/test/renderWithQuery';

import { useChatStream } from './useChatStream';

// Stub the chat-agent server actions — they're now called directly from
// useChatStream (no public /api/agent/proposals/* endpoint to intercept via
// fetch mock). Tests can replace the mocks via `vi.mocked(...)` per case.
vi.mock('../../admin/actions/agent', () => ({
  acceptProposalAction: vi.fn(),
  rejectProposalAction: vi.fn(),
}));

/**
 * Build an SSE-style ReadableStream from a list of body chunks (strings) and
 * an optional `delayMs` between chunks. Lets us test the streaming/abort
 * path without spinning up a real server.
 */
function makeSseStream(chunks: string[], delayMs = 0): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      const chunk = chunks[i++];
      if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
      controller.enqueue(encoder.encode(chunk));
    },
  });
}

describe('useChatStream — stop()', () => {
  let originalFetch: typeof globalThis.fetch;
  let lastInit: RequestInit | null = null;
  const { Wrapper } = withQuery();

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    lastInit = null;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('aborts the in-flight fetch and flips status to "stopped"', async () => {
    let abortReceived = false;
    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      lastInit = init ?? null;
      // Listen for abort so we can verify the signal propagated.
      init?.signal?.addEventListener('abort', () => {
        abortReceived = true;
      });
      return new Response(
        // Drip-feed SSE chunks so we have time to abort mid-stream.
        makeSseStream(
          [
            'data: {"type":"text_delta","text":"Hello "}\n\n',
            'data: {"type":"text_delta","text":"world"}\n\n',
            'data: {"type":"done"}\n\n',
          ],
          50,
        ),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      );
    }) as typeof globalThis.fetch;

    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });

    // Kick off a streaming request — don't await; we need to abort while it's mid-flight.
    let sendPromise: Promise<void> = Promise.resolve();
    act(() => {
      sendPromise = result.current.send('test');
    });

    // Wait one microtask so fetch is in-flight and status is 'streaming'.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.status).toBe('streaming');

    // Stop mid-stream.
    act(() => {
      result.current.stop();
    });

    // The send promise should resolve cleanly (no thrown error) — abort is swallowed.
    await act(async () => {
      await sendPromise;
    });

    expect(result.current.status).toBe('stopped');
    expect(abortReceived).toBe(true);
    // The fetch was issued with a signal — that's the abort hook.
    expect(lastInit?.signal).toBeDefined();
  });

  it('does nothing when called while idle', () => {
    globalThis.fetch = vi.fn(() => Promise.resolve(new Response(makeSseStream([])))) as typeof globalThis.fetch;
    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });
    expect(result.current.status).toBe('idle');
    act(() => {
      result.current.stop();
    });
    expect(result.current.status).toBe('idle');
  });

  it('reset() also cancels any in-flight stream', async () => {
    let aborted = false;
    globalThis.fetch = vi.fn(async (_url, init?: RequestInit) => {
      init?.signal?.addEventListener('abort', () => {
        aborted = true;
      });
      return new Response(makeSseStream(['data: {"type":"done"}\n\n'], 100), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof globalThis.fetch;

    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });
    let p: Promise<void> = Promise.resolve();
    act(() => {
      p = result.current.send('test');
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
    expect(result.current.status).toBe('streaming');

    act(() => {
      result.current.reset();
    });
    await act(async () => {
      await p;
    });
    expect(aborted).toBe(true);
    // After reset(), the hook is back to its initial idle state.
    expect(result.current.status).toBe('idle');
    expect(result.current.entries).toEqual([]);
  });
});

describe('useChatStream — proposal accept', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('invalidates entries queries after a successful accept', async () => {
    const proposal = {
      id: 'prop-int-1',
      toolUseId: 'tool-1',
      reasoning: 'r',
      summary: 'Edit title',
      kind: 'edit' as const,
      collection: 'post',
      entryPath: 'cms/content/post/p.json',
      entryId: 'p',
      fieldChanges: { title: 'New' },
    };
    const proposalLine = `data: ${JSON.stringify({ type: 'proposal', proposal })}\n\n`;
    const doneLine = `data: ${JSON.stringify({ type: 'done' })}\n\n`;

    let agentCalls = 0;
    globalThis.fetch = vi.fn(async () => {
      agentCalls += 1;
      return new Response(makeSseStream([proposalLine, doneLine]), {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      });
    }) as typeof globalThis.fetch;
    vi.mocked(acceptProposalAction).mockResolvedValue({ ok: true, entryPath: 'cms/content/post/p.json' });
    vi.mocked(rejectProposalAction).mockResolvedValue({ ok: true });

    const { Wrapper, client } = withQuery();
    client.setQueryData(queryKeys.entries.list('post'), []);

    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.send('hi');
    });
    await waitFor(() => expect(result.current.proposals['prop-int-1']?.status.kind).toBe('pending'));

    await act(async () => {
      await result.current.acceptProposal('prop-int-1');
    });

    expect(agentCalls).toBeGreaterThanOrEqual(2);
    expect(client.getQueryState(queryKeys.entries.list('post'))?.isInvalidated).toBe(true);
  });
});

describe('useChatStream — hydrate & getSnapshot', () => {
  const { Wrapper } = withQuery();

  it('getSnapshot returns null when transcript is empty', () => {
    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });
    expect(result.current.getSnapshot()).toBeNull();
  });

  it('hydrate restores entries and history', () => {
    const { result } = renderHook(() => useChatStream(), { wrapper: Wrapper });
    act(() => {
      result.current.hydrate({
        entries: [
          { id: 'u1', kind: 'user', text: 'saved question' },
          {
            id: 'a1',
            kind: 'assistant',
            text: 'saved answer',
            toolCalls: [],
            proposalIds: [],
            streaming: false,
          },
        ],
        history: [
          { role: 'user', content: 'saved question' },
          { role: 'assistant', content: [{ type: 'text', text: 'saved answer' }] },
        ],
        meta: { provider: 'anthropic', model: 'claude' },
        usage: { inputTokens: 1, outputTokens: 2, cachedInputTokens: 0, totalCostUSD: 0 },
        status: 'idle',
        error: null,
        budgetReason: null,
        proposals: {},
      });
    });
    expect(result.current.entries).toHaveLength(2);
    expect(result.current.entries[0]).toMatchObject({ kind: 'user', text: 'saved question' });
    expect(result.current.getSnapshot()?.history).toHaveLength(2);
    expect(result.current.getSnapshot()?.entries).toHaveLength(2);
  });
});
