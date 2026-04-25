/**
 * Provider-agnostic chat interface.
 *
 * Each chat provider (Anthropic, OpenAI, local) implements {@link ChatProvider}.
 * The agent loop in {@link ../chat.ts} talks only to this interface — it never
 * sees the underlying SDK's content blocks. Adapters absorb wire-format
 * differences and emit a normalised event stream.
 */
import type { AgentProvider } from '../types';

/** A single message exchanged with the model. */
export type NormalizedMessage =
  | { role: 'user'; content: string | NormalizedContentBlock[] }
  | { role: 'assistant'; content: NormalizedContentBlock[] }
  | { role: 'tool'; toolUseId: string; content: string; isError?: boolean };

/** Content blocks the agent emits. v1 is text + tool_use + tool_result; Phase 5 adds documents. */
export type NormalizedContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  /**
   * Phase 5 — native PDF attachment passed through to providers that support it
   * (Anthropic). Adapters that lack native support (`supportsNativePdf === false`)
   * fall back to a text block at attachment-normalisation time, so this variant
   * should not reach those adapters in practice.
   */
  | { type: 'document_pdf'; base64: string; mediaType: 'application/pdf'; filename: string };

/** Tool exposed to the model. */
export type NormalizedTool = {
  /** Stable identifier, also the function name in OpenAI's tool API. */
  name: string;
  /** Short description shown to the model. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
};

/**
 * Events the adapter emits during streaming. The agent loop assembles them
 * into the next assistant message and decides whether to call tools.
 */
export type ProviderEvent =
  /** A chunk of streamed assistant text. */
  | { type: 'text_delta'; text: string }
  /** Start of a tool call — name and id are known, input streams in deltas. */
  | { type: 'tool_use_start'; id: string; name: string }
  /** Partial JSON for the in-progress tool call. */
  | { type: 'tool_use_input_delta'; id: string; partialJson: string }
  /** Tool call complete — final parsed input is provided. */
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  /** End of the assistant turn. `stopReason` mirrors Anthropic's set. */
  | {
      type: 'message_stop';
      stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other';
      usage: { inputTokens: number; outputTokens: number; cachedInputTokens?: number };
    }
  /** Adapter-level error (network, malformed response, missing peer dep). */
  | { type: 'error'; message: string };

export type ChatStreamInput = {
  messages: NormalizedMessage[];
  tools: NormalizedTool[];
  systemPrompt: string;
  maxOutputTokens: number;
};

export interface ChatProvider {
  /**
   * Stream a single assistant turn. The async iterable ends after the
   * `message_stop` event (or after `error`). Adapters MUST emit
   * `tool_use_complete` for every started tool call before `message_stop`.
   */
  streamChat(input: ChatStreamInput): AsyncIterable<ProviderEvent>;

  /** Provider type — mirrors the discriminator on {@link AgentProvider}. */
  readonly providerType: AgentProvider['type'];
  /** Model identifier — used for UI labels. */
  readonly modelId: string;
  /** True if the adapter passes PDFs natively (Phase 5). */
  readonly supportsNativePdf: boolean;
}
