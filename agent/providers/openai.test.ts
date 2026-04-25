/**
 * Unit tests for the OpenAI / local provider adapter.
 *
 * We mock the `openai` SDK with a fake that yields a deterministic chunk
 * stream. The adapter is responsible for translating those chunks into our
 * normalised events.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LocalProvider, OpenAIProvider } from '../types';

const mockCreate = vi.fn();

class FakeOpenAI {
  chat = { completions: { create: mockCreate } };
  static lastInit: unknown;
  constructor(init: unknown) {
    FakeOpenAI.lastInit = init;
  }
}

vi.mock('openai', () => ({
  default: FakeOpenAI,
}));

async function* asyncIterable<T>(items: T[]): AsyncIterable<T> {
  for (const it of items) yield it;
}

beforeEach(() => {
  mockCreate.mockReset();
  FakeOpenAI.lastInit = undefined;
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

describe('OpenAIChatProvider — text streaming', () => {
  it('emits text_delta + message_stop with usage', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValueOnce(
      asyncIterable([
        { choices: [{ delta: { content: 'Hello ' } }] },
        { choices: [{ delta: { content: 'world' } }] },
        { choices: [{ delta: {}, finish_reason: 'stop' }] },
        { choices: [], usage: { prompt_tokens: 10, completion_tokens: 4 } },
      ]),
    );

    const { OpenAIChatProvider } = await import('./openai');
    const provider: OpenAIProvider = {
      type: 'openai',
      model: 'gpt-test',
      pricing: { inputPerM: 1, outputPerM: 1, cachedInputPerM: 0 },
    };
    const adapter = new OpenAIChatProvider(provider);
    const events = await collect(
      adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }], tools: [], systemPrompt: 'sys', maxOutputTokens: 100 }),
    );

    expect(events).toEqual([
      { type: 'text_delta', text: 'Hello ' },
      { type: 'text_delta', text: 'world' },
      {
        type: 'message_stop',
        stopReason: 'end_turn',
        usage: { inputTokens: 10, outputTokens: 4, cachedInputTokens: 0 },
      },
    ]);

    expect(mockCreate).toHaveBeenCalledOnce();
    const req = mockCreate.mock.calls[0][0] as { messages: { role: string; content: string | null }[] };
    expect(req.messages[0]).toEqual({ role: 'system', content: 'sys' });
    expect(req.messages[1]).toEqual({ role: 'user', content: 'hi' });
  });
});

describe('OpenAIChatProvider — tool calls', () => {
  it('reassembles fragmented tool_calls deltas into one tool_use_complete', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    mockCreate.mockResolvedValueOnce(
      asyncIterable([
        {
          choices: [
            {
              delta: {
                tool_calls: [
                  { index: 0, id: 'call_1', function: { name: 'searchContent', arguments: '{"qu' } },
                ],
              },
            },
          ],
        },
        {
          choices: [
            { delta: { tool_calls: [{ index: 0, function: { arguments: 'ery":"foo"}' } }] } },
          ],
        },
        { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
        { choices: [], usage: { prompt_tokens: 5, completion_tokens: 2 } },
      ]),
    );

    const { OpenAIChatProvider } = await import('./openai');
    const adapter = new OpenAIChatProvider({
      type: 'openai',
      model: 'gpt-test',
      pricing: { inputPerM: 1, outputPerM: 1, cachedInputPerM: 0 },
    });
    const events = await collect(
      adapter.streamChat({
        messages: [{ role: 'user', content: 'find foo' }],
        tools: [
          { name: 'searchContent', description: 'x', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } },
        ],
        systemPrompt: 's',
        maxOutputTokens: 50,
      }),
    );

    expect(events).toContainEqual({ type: 'tool_use_start', id: 'call_1', name: 'searchContent' });
    expect(events).toContainEqual({ type: 'tool_use_input_delta', id: 'call_1', partialJson: '{"qu' });
    expect(events).toContainEqual({ type: 'tool_use_input_delta', id: 'call_1', partialJson: 'ery":"foo"}' });
    expect(events).toContainEqual({
      type: 'tool_use_complete',
      id: 'call_1',
      name: 'searchContent',
      input: { query: 'foo' },
    });
    const stop = events.find((e) => e.type === 'message_stop');
    expect(stop).toBeDefined();
    expect((stop as { stopReason: string }).stopReason).toBe('tool_use');
  });
});

describe('OpenAIChatProvider — local provider', () => {
  it('forwards baseURL and tolerates a missing api key', async () => {
    delete process.env.OPENAI_API_KEY;
    mockCreate.mockResolvedValueOnce(asyncIterable([{ choices: [{ delta: {}, finish_reason: 'stop' }] }]));

    const { OpenAIChatProvider } = await import('./openai');
    const provider: LocalProvider = {
      type: 'local',
      model: 'qwen/qwen2.5-coder-14b',
      baseURL: 'http://localhost:1234/v1',
    };
    const adapter = new OpenAIChatProvider(provider);
    await collect(
      adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }], tools: [], systemPrompt: '', maxOutputTokens: 10 }),
    );
    expect(FakeOpenAI.lastInit).toMatchObject({ baseURL: 'http://localhost:1234/v1' });
  });

  it('errors loudly when the openai provider has no api key', async () => {
    delete process.env.OPENAI_API_KEY;
    const { OpenAIChatProvider } = await import('./openai');
    const adapter = new OpenAIChatProvider({
      type: 'openai',
      model: 'gpt-test',
      pricing: { inputPerM: 1, outputPerM: 1, cachedInputPerM: 0 },
    });
    const events = await collect(
      adapter.streamChat({ messages: [{ role: 'user', content: 'hi' }], tools: [], systemPrompt: '', maxOutputTokens: 10 }),
    );
    expect(events[0]).toMatchObject({ type: 'error' });
    expect((events[0] as { message: string }).message).toContain('OPENAI_API_KEY');
  });
});
