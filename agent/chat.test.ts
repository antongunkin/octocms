/**
 * Unit tests for the agent loop. We bypass real providers + tools: a fake
 * `ChatProvider` produces scripted event streams, and we let the registered
 * tools run with a mocked `searchContent` for the searchContent test.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ChatProvider, ProviderEvent, ChatStreamInput } from './providers/types';
import type { AgentConfig } from './types';
import type { Config } from '../types';

const minimalConfig: Config = {
  projectName: 'T',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: { title: { label: 'Title', format: 'string', required: true, entryTitle: true } },
    },
  },
} as unknown as Config;

const agentConfig: AgentConfig = {
  provider: { type: 'local', model: 'test', baseURL: 'http://x' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 20,
  maxAttachmentBytes: 100,
  maxAttachmentsPerTurn: 1,
  totalBudgetUSD: 0,
};

function makeProvider(scripts: ProviderEvent[][]): ChatProvider {
  let turn = 0;
  return {
    providerType: 'local',
    modelId: 'test',
    supportsNativePdf: false,
    async *streamChat(_input: ChatStreamInput) {
      const list = scripts[turn] ?? [];
      turn += 1;
      for (const ev of list) yield ev;
    },
  };
}

beforeEach(() => {
  // Reset usage to keep tests independent.
  return import('./usage').then((u) => u.resetUsage());
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

describe('runChat — text-only response', () => {
  it('streams text deltas and finishes with done', async () => {
    const { runChat } = await import('./chat');
    const provider = makeProvider([
      [
        { type: 'text_delta', text: 'Hi ' },
        { type: 'text_delta', text: 'there' },
        { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 5, outputTokens: 2 } },
      ],
    ]);
    const events = await collect(
      runChat({
        agentConfig,
        config: minimalConfig,
        systemPrompt: 'sys',
        messages: [{ role: 'user', content: 'hello' }],
        provider,
        tools: [],
      }),
    );

    const types = events.map((e) => e.type);
    expect(types).toEqual(['text_delta', 'text_delta', 'usage', 'turn_stop', 'done']);
    expect((events.find((e) => e.type === 'usage') as { totalCostUSD: number }).totalCostUSD).toBe(0);
  });
});

describe('runChat — tool use loop', () => {
  it('runs the searchContent tool and feeds its result back to the next turn', async () => {
    // Stub `searchContent` so we don't spin up the embedder.
    vi.doMock('./search', () => ({
      searchContent: vi.fn().mockResolvedValue([
        {
          id: 'post-a',
          path: 'cms/content/post/post-a.json',
          collection: 'post',
          score: 0.9,
          title: 'A',
          excerpt: 'A!',
        },
      ]),
      clearSearchCache: vi.fn(),
    }));

    // Re-import after doMock so the tools module picks up the stub.
    vi.resetModules();
    const { runChat } = await import('./chat');

    const provider = makeProvider([
      // Turn 1 — model asks for the search tool.
      [
        { type: 'tool_use_start', id: 't1', name: 'searchContent' },
        { type: 'tool_use_complete', id: 't1', name: 'searchContent', input: { query: 'A' } },
        { type: 'message_stop', stopReason: 'tool_use', usage: { inputTokens: 10, outputTokens: 5 } },
      ],
      // Turn 2 — model writes the final answer.
      [
        { type: 'text_delta', text: 'Found A.' },
        { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 12, outputTokens: 3 } },
      ],
    ]);

    const events = await collect(
      runChat({
        agentConfig,
        config: minimalConfig,
        systemPrompt: 's',
        messages: [{ role: 'user', content: 'find A' }],
        provider,
      }),
    );

    const toolResult = events.find((e) => e.type === 'tool_result');
    expect(toolResult).toBeDefined();
    expect((toolResult as { name: string }).name).toBe('searchContent');
    const parsed = JSON.parse((toolResult as { result: string }).result);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].id).toBe('post-a');

    const text = events.filter((e) => e.type === 'text_delta');
    expect(text.map((t) => (t as { text: string }).text).join('')).toBe('Found A.');

    const done = events.find((e) => e.type === 'done');
    expect(done).toBeDefined();
  });

  it('returns "Unknown tool" when the model invents a tool', async () => {
    const { runChat } = await import('./chat');
    const provider = makeProvider([
      [
        { type: 'tool_use_start', id: 't1', name: 'noSuchTool' },
        { type: 'tool_use_complete', id: 't1', name: 'noSuchTool', input: {} },
        { type: 'message_stop', stopReason: 'tool_use', usage: { inputTokens: 1, outputTokens: 1 } },
      ],
      [
        { type: 'text_delta', text: 'sorry' },
        { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 2, outputTokens: 1 } },
      ],
    ]);
    const events = await collect(
      runChat({
        agentConfig,
        config: minimalConfig,
        systemPrompt: 's',
        messages: [{ role: 'user', content: 'use a fake tool' }],
        provider,
      }),
    );
    const toolResult = events.find((e) => e.type === 'tool_result') as { result: string; isError: boolean } | undefined;
    expect(toolResult).toBeDefined();
    expect(toolResult!.isError).toBe(true);
    expect(JSON.parse(toolResult!.result).error).toContain('noSuchTool');
  });
});

describe('runChat — error handling', () => {
  it('terminates on a provider-level error event', async () => {
    const { runChat } = await import('./chat');
    const provider = makeProvider([[{ type: 'error', message: 'connection refused' }]]);
    const events = await collect(
      runChat({
        agentConfig,
        config: minimalConfig,
        systemPrompt: '',
        messages: [{ role: 'user', content: 'x' }],
        provider,
        tools: [],
      }),
    );
    expect(events).toEqual([{ type: 'error', message: 'connection refused' }]);
  });
});
