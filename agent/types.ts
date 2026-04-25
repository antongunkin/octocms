/**
 * Pricing for the chat model in use, in USD per million tokens.
 * Look up current numbers in your provider's pricing page (Anthropic, OpenAI, …).
 * Local providers can omit this — the helpers treat absent pricing as $0.
 */
export type AgentPricing = {
  inputPerM: number;
  outputPerM: number;
  cachedInputPerM: number;
};

/** Anthropic Claude (uses `@anthropic-ai/sdk`). */
export type AnthropicProvider = {
  type: 'anthropic';
  /** Anthropic model ID, e.g. `'claude-haiku-4-5-20251001'`. */
  model: string;
  pricing: AgentPricing;
  /** Env var holding the API key. Defaults to `ANTHROPIC_API_KEY`. */
  apiKeyEnv?: string;
};

/** OpenAI (uses `openai` SDK). Also covers Azure / OpenAI-compatible proxies via `baseURL`. */
export type OpenAIProvider = {
  type: 'openai';
  /** OpenAI model ID, e.g. `'gpt-4.1-mini'`. */
  model: string;
  pricing: AgentPricing;
  /** Env var holding the API key. Defaults to `OPENAI_API_KEY`. */
  apiKeyEnv?: string;
  /** Optional override — set for Azure OpenAI or compatible proxies. */
  baseURL?: string;
};

/**
 * Local model served behind an OpenAI-compatible HTTP endpoint
 * (Ollama, LM Studio, vLLM, llama.cpp server, …). Uses the `openai` SDK with
 * a custom `baseURL`. Pricing is optional — defaults to free.
 */
export type LocalProvider = {
  type: 'local';
  /** Model identifier the runtime expects, e.g. `'llama3.2:3b'` for Ollama. */
  model: string;
  /** OpenAI-compatible endpoint, e.g. `'http://localhost:11434/v1'`. */
  baseURL: string;
  /** Env var holding an optional API key (some local servers require one). */
  apiKeyEnv?: string;
  /** Usually omitted — useful if you want to track imputed cost for budgeting. */
  pricing?: AgentPricing;
};

export type AgentProvider = AnthropicProvider | OpenAIProvider | LocalProvider;

/**
 * Universal user-tunable configuration for the chat agent. Lives in the
 * consumer's project as part of `cms/octocms.config.ts` (see
 * `defineAgentConfig`). The package never hardcodes these values — every
 * helper accepts the config explicitly.
 */
export type AgentConfig = {
  /** Chat provider — Anthropic, OpenAI, or a local OpenAI-compatible endpoint. */
  provider: AgentProvider;
  /** Hard caps per single conversation. */
  maxInputTokens: number;
  maxOutputTokens: number;
  /** Cap on tool-use proposals emitted in a single agent turn. */
  maxProposalsPerTurn: number;
  /** Per-attachment size limit (bytes). */
  maxAttachmentBytes: number;
  /** Cap on attachments per chat turn. */
  maxAttachmentsPerTurn: number;
  /**
   * Cumulative spend cap for the deploy. When exceeded the chat is disabled
   * exactly as if no API key were set (route returns 404, nav link hidden).
   * Set to `0` to disable the budget cap (e.g. for local providers).
   */
  totalBudgetUSD: number;
};
