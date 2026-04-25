/**
 * Picks the right {@link ChatProvider} for an `AgentProvider` config.
 *
 * Lazy-imports the SDK adapter so a project that only uses Anthropic doesn't
 * need `openai` installed (and vice versa).
 */
import type { AgentProvider } from '../types';
import type { ChatProvider } from './types';

export function getChatProvider(provider: AgentProvider): ChatProvider {
  if (provider.type === 'anthropic') {
    // Synchronous import is fine — the file itself only loads `@anthropic-ai/sdk`
    // lazily inside `streamChat`, so import-cost stays cheap even when the SDK
    // isn't installed.
    const { AnthropicChatProvider } = require('./anthropic') as typeof import('./anthropic');
    return new AnthropicChatProvider(provider);
  }
  if (provider.type === 'openai' || provider.type === 'local') {
    const { OpenAIChatProvider } = require('./openai') as typeof import('./openai');
    return new OpenAIChatProvider(provider);
  }
  throw new Error(`Unknown agent provider: ${(provider as { type?: string }).type ?? 'undefined'}`);
}

export type {
  ChatProvider,
  ChatStreamInput,
  NormalizedContentBlock,
  NormalizedMessage,
  NormalizedTool,
  ProviderEvent,
} from './types';
