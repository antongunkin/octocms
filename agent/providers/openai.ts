/**
 * OpenAI adapter — wraps `openai` SDK `chat.completions.create({ stream: true })`.
 *
 * Powers both `'openai'` and `'local'` providers. The `'local'` variant just
 * sets `baseURL` to a local OpenAI-compatible endpoint (Ollama, LM Studio,
 * vLLM, llama.cpp server) and treats a missing API key as "no auth needed".
 *
 * The Chat Completions API streams tool calls as JSON-string `arguments`
 * deltas; we accumulate them and parse once the call ends.
 */
import type { LocalProvider, OpenAIProvider } from '../types';
import { providerApiKeyEnv } from '../featureFlag';

import type {
  ChatProvider,
  ChatStreamInput,
  NormalizedMessage,
  NormalizedTool,
  ProviderEvent,
} from './types';

type OpenAISdk = typeof import('openai');

async function loadSdk(): Promise<OpenAISdk> {
  try {
    return (await import('openai')) as unknown as OpenAISdk;
  } catch {
    throw new Error(
      'The chat agent is configured for OpenAI / local but the optional peer dependency `openai` is not installed. Run: npm install openai',
    );
  }
}

type OpenAIMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | {
      role: 'assistant';
      content: string | null;
      tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
    }
  | { role: 'tool'; tool_call_id: string; content: string };

function toOpenAIMessages(systemPrompt: string, messages: NormalizedMessage[]): OpenAIMessage[] {
  const out: OpenAIMessage[] = [];
  if (systemPrompt) out.push({ role: 'system', content: systemPrompt });

  for (const m of messages) {
    if (m.role === 'tool') {
      out.push({ role: 'tool', tool_call_id: m.toolUseId, content: m.content });
      continue;
    }
    if (m.role === 'user') {
      const text = typeof m.content === 'string' ? m.content : extractText(m.content);
      out.push({ role: 'user', content: text });
      continue;
    }
    // assistant
    let text = '';
    const toolCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = [];
    for (const block of m.content) {
      if (block.type === 'text') text += block.text;
      else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          type: 'function',
          function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
        });
      }
    }
    out.push({
      role: 'assistant',
      content: text || null,
      ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
    });
  }
  return out;
}

function extractText(blocks: { type: string; text?: string; filename?: string }[]): string {
  // Defensive: this provider doesn't support native PDFs. The route handler
  // converts PDFs to text BEFORE the message reaches us. If we still see a
  // `document_pdf` block (e.g. a hand-built request), surface a clear marker
  // so the model knows the binary was dropped.
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === 'text') {
      parts.push(b.text ?? '');
    } else if (b.type === 'document_pdf') {
      parts.push(`[Attached PDF "${b.filename ?? 'document.pdf'}" — binary content not available to this provider]`);
    }
  }
  return parts.join('\n');
}

function toOpenAITools(tools: NormalizedTool[]): unknown[] {
  return tools.map((t) => ({
    type: 'function',
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }));
}

export class OpenAIChatProvider implements ChatProvider {
  readonly supportsNativePdf = false;

  constructor(private readonly provider: OpenAIProvider | LocalProvider) {}

  get providerType(): 'openai' | 'local' {
    return this.provider.type;
  }

  get modelId(): string {
    return this.provider.model;
  }

  async *streamChat(input: ChatStreamInput): AsyncIterable<ProviderEvent> {
    let sdk: OpenAISdk;
    try {
      sdk = await loadSdk();
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Failed to load OpenAI SDK' };
      return;
    }

    const envName = providerApiKeyEnv(this.provider);
    const apiKey = envName ? process.env[envName] : undefined;
    const baseURL =
      this.provider.type === 'local'
        ? this.provider.baseURL
        : (this.provider as OpenAIProvider).baseURL ?? undefined;

    if (this.provider.type === 'openai' && !apiKey) {
      yield {
        type: 'error',
        message: `Missing API key — set ${envName ?? 'OPENAI_API_KEY'} in the environment.`,
      };
      return;
    }

    const OpenAI = (sdk as unknown as { default: new (opts: unknown) => unknown }).default ?? sdk;
    const client = new (OpenAI as new (opts: { apiKey?: string; baseURL?: string }) => {
      chat: {
        completions: {
          create: (req: unknown) => Promise<AsyncIterable<unknown>>;
        };
      };
    })({
      // Local servers usually don't need a key; pass a dummy if none provided to satisfy the SDK guard.
      apiKey: apiKey ?? (this.provider.type === 'local' ? 'lm-studio' : ''),
      ...(baseURL ? { baseURL } : {}),
    });

    const messages = toOpenAIMessages(input.systemPrompt, input.messages);
    const tools = input.tools.length > 0 ? toOpenAITools(input.tools) : undefined;

    let stream: AsyncIterable<unknown>;
    try {
      stream = await client.chat.completions.create({
        model: this.provider.model,
        max_tokens: input.maxOutputTokens,
        stream: true,
        stream_options: { include_usage: true },
        messages,
        ...(tools ? { tools } : {}),
      });
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'OpenAI stream failed to open' };
      return;
    }

    type ToolCallAccum = { id: string; name: string; argsJson: string; emittedStart: boolean };
    const toolCalls = new Map<number, ToolCallAccum>();
    let finishReason: string | null = null;
    let usage: { input?: number; output?: number; cached?: number } = {};

    try {
      for await (const chunk of stream as AsyncIterable<{
        choices?: { delta?: { content?: string; tool_calls?: unknown[] }; finish_reason?: string }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number; prompt_tokens_details?: { cached_tokens?: number } };
      }>) {
        const choice = chunk.choices?.[0];
        const delta = choice?.delta;
        if (delta?.content) {
          yield { type: 'text_delta', text: delta.content };
        }
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls as {
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }[]) {
            const idx = tc.index;
            let acc = toolCalls.get(idx);
            if (!acc) {
              acc = { id: tc.id ?? `tool_${idx}`, name: '', argsJson: '', emittedStart: false };
              toolCalls.set(idx, acc);
            }
            if (tc.id) acc.id = tc.id;
            if (tc.function?.name) acc.name = tc.function.name;
            if (!acc.emittedStart && acc.name) {
              acc.emittedStart = true;
              yield { type: 'tool_use_start', id: acc.id, name: acc.name };
            }
            if (tc.function?.arguments) {
              acc.argsJson += tc.function.arguments;
              if (acc.emittedStart) {
                yield { type: 'tool_use_input_delta', id: acc.id, partialJson: tc.function.arguments };
              }
            }
          }
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
        if (chunk.usage) {
          usage = {
            input: chunk.usage.prompt_tokens,
            output: chunk.usage.completion_tokens,
            cached: chunk.usage.prompt_tokens_details?.cached_tokens,
          };
        }
      }
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'OpenAI stream failed' };
      return;
    }

    // Emit final tool_use_complete events for any tool calls collected.
    for (const acc of toolCalls.values()) {
      if (!acc.emittedStart) {
        yield { type: 'tool_use_start', id: acc.id, name: acc.name };
      }
      let parsed: unknown = {};
      try {
        parsed = acc.argsJson ? JSON.parse(acc.argsJson) : {};
      } catch {
        parsed = { _rawInput: acc.argsJson };
      }
      yield { type: 'tool_use_complete', id: acc.id, name: acc.name, input: parsed };
    }

    yield {
      type: 'message_stop',
      stopReason: mapFinishReason(finishReason, toolCalls.size > 0),
      usage: {
        inputTokens: usage.input ?? 0,
        outputTokens: usage.output ?? 0,
        cachedInputTokens: usage.cached ?? 0,
      },
    };
  }
}

function mapFinishReason(
  r: string | null,
  hadToolCalls: boolean,
): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other' {
  if (r === 'tool_calls' || (hadToolCalls && r !== 'length')) return 'tool_use';
  if (r === 'stop') return 'end_turn';
  if (r === 'length') return 'max_tokens';
  return 'other';
}
