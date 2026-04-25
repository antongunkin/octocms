/**
 * Anthropic adapter — wraps `@anthropic-ai/sdk` `messages.stream()`.
 *
 * Maps Anthropic's content-block streaming events into our normalised
 * {@link ProviderEvent} stream. The SDK is loaded lazily so a missing peer
 * dep surfaces here instead of at module-import time.
 */
import type { AnthropicProvider } from '../types';
import { providerApiKeyEnv } from '../featureFlag';

import type { ChatProvider, ChatStreamInput, NormalizedMessage, NormalizedTool, ProviderEvent } from './types';

type AnthropicSdk = typeof import('@anthropic-ai/sdk');

async function loadSdk(): Promise<AnthropicSdk> {
  try {
    return (await import('@anthropic-ai/sdk')) as unknown as AnthropicSdk;
  } catch {
    throw new Error(
      'The chat agent is configured for Anthropic but the optional peer dependency `@anthropic-ai/sdk` is not installed. Run: npm install @anthropic-ai/sdk',
    );
  }
}

function toAnthropicMessages(messages: NormalizedMessage[]): unknown[] {
  // Anthropic alternates user/assistant, with `tool_result` blocks living
  // inside a user message. We coalesce consecutive `tool` messages into a
  // single user message of `tool_result` blocks.
  const out: { role: 'user' | 'assistant'; content: unknown }[] = [];
  for (const m of messages) {
    if (m.role === 'tool') {
      const last = out[out.length - 1];
      const block = {
        type: 'tool_result' as const,
        tool_use_id: m.toolUseId,
        content: m.content,
        ...(m.isError ? { is_error: true } : {}),
      };
      if (last && last.role === 'user' && Array.isArray(last.content)) {
        (last.content as unknown[]).push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
      continue;
    }
    if (m.role === 'user') {
      if (typeof m.content === 'string') {
        out.push({ role: 'user', content: m.content });
      } else {
        const blocks = m.content.map((b) => mapUserBlockToAnthropic(b));
        out.push({ role: 'user', content: blocks });
      }
      continue;
    }
    // assistant — text + tool_use only
    const blocks = m.content.map((b) => {
      if (b.type === 'text') return { type: 'text', text: b.text };
      if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input };
      // Defensive — assistant turns shouldn't include document blocks. Drop to text.
      return { type: 'text', text: `[unexpected ${b.type} block]` };
    });
    out.push({ role: 'assistant', content: blocks });
  }
  return out;
}

/**
 * Map a normalised user content block to Anthropic's wire format. PDF
 * attachments become native `document` blocks (Claude reads them directly,
 * including images and layout); text blocks pass through unchanged.
 */
function mapUserBlockToAnthropic(block: { type: string; [k: string]: unknown }): unknown {
  if (block.type === 'text') {
    return { type: 'text', text: block.text };
  }
  if (block.type === 'document_pdf') {
    return {
      type: 'document',
      source: {
        type: 'base64',
        media_type: block.mediaType,
        data: block.base64,
      },
      title: block.filename,
    };
  }
  // Unsupported block type — drop to a placeholder so the request isn't malformed.
  return { type: 'text', text: `[unsupported block: ${block.type}]` };
}

function toAnthropicTools(tools: NormalizedTool[]): unknown[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

export class AnthropicChatProvider implements ChatProvider {
  readonly providerType = 'anthropic' as const;
  readonly supportsNativePdf = true;

  constructor(private readonly provider: AnthropicProvider) {}

  get modelId(): string {
    return this.provider.model;
  }

  async *streamChat(input: ChatStreamInput): AsyncIterable<ProviderEvent> {
    let sdk: AnthropicSdk;
    try {
      sdk = await loadSdk();
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Failed to load Anthropic SDK' };
      return;
    }

    const envName = providerApiKeyEnv(this.provider) ?? 'ANTHROPIC_API_KEY';
    const apiKey = process.env[envName];
    if (!apiKey) {
      yield { type: 'error', message: `Missing API key — set ${envName} in the environment.` };
      return;
    }

    const Anthropic = (sdk as unknown as { default: new (opts: { apiKey: string }) => unknown }).default ?? sdk;
    const client = new (
      Anthropic as new (opts: { apiKey: string }) => {
        messages: { stream: (req: unknown) => AsyncIterable<unknown> & { finalMessage(): Promise<unknown> } };
      }
    )({ apiKey });

    const stream = client.messages.stream({
      model: this.provider.model,
      max_tokens: input.maxOutputTokens,
      system: input.systemPrompt,
      messages: toAnthropicMessages(input.messages),
      ...(input.tools.length > 0 ? { tools: toAnthropicTools(input.tools) } : {}),
    });

    const inputJsonByIndex = new Map<number, string>();
    const idByIndex = new Map<number, string>();
    const nameByIndex = new Map<number, string>();

    try {
      for await (const ev of stream as AsyncIterable<{ type: string } & Record<string, unknown>>) {
        switch (ev.type) {
          case 'content_block_start': {
            const idx = ev.index as number;
            const block = ev.content_block as { type: string; id?: string; name?: string };
            if (block.type === 'tool_use') {
              const id = block.id ?? `tool_${idx}`;
              const name = block.name ?? '';
              idByIndex.set(idx, id);
              nameByIndex.set(idx, name);
              inputJsonByIndex.set(idx, '');
              yield { type: 'tool_use_start', id, name };
            }
            break;
          }
          case 'content_block_delta': {
            const idx = ev.index as number;
            const delta = ev.delta as { type: string; text?: string; partial_json?: string };
            if (delta.type === 'text_delta' && typeof delta.text === 'string') {
              yield { type: 'text_delta', text: delta.text };
            } else if (delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
              const id = idByIndex.get(idx);
              if (id) {
                inputJsonByIndex.set(idx, (inputJsonByIndex.get(idx) ?? '') + delta.partial_json);
                yield { type: 'tool_use_input_delta', id, partialJson: delta.partial_json };
              }
            }
            break;
          }
          case 'content_block_stop': {
            const idx = ev.index as number;
            const id = idByIndex.get(idx);
            const name = nameByIndex.get(idx);
            if (id && name !== undefined) {
              const raw = inputJsonByIndex.get(idx) ?? '';
              let parsed: unknown = {};
              try {
                parsed = raw ? JSON.parse(raw) : {};
              } catch {
                parsed = { _rawInput: raw };
              }
              yield { type: 'tool_use_complete', id, name, input: parsed };
            }
            break;
          }
          default:
            break;
        }
      }
      const final = (await stream.finalMessage()) as {
        stop_reason?: string;
        usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number };
      };
      const usage = final.usage ?? {};
      yield {
        type: 'message_stop',
        stopReason: mapAnthropicStopReason(final.stop_reason),
        usage: {
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cachedInputTokens: usage.cache_read_input_tokens ?? 0,
        },
      };
    } catch (err) {
      yield { type: 'error', message: err instanceof Error ? err.message : 'Anthropic stream failed' };
    }
  }
}

function mapAnthropicStopReason(r: unknown): 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other' {
  if (r === 'end_turn' || r === 'tool_use' || r === 'max_tokens' || r === 'stop_sequence') return r;
  return 'other';
}
