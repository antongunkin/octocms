export type {
  AgentConfig,
  AgentPricing,
  AgentProvider,
  AnthropicProvider,
  OpenAIProvider,
  LocalProvider,
} from './types';
export { DEFAULT_AGENT_CONFIG, defineAgentConfig } from './defaults';
export { estimateCostUSD, getProviderPricing } from './pricing';
export { getAgentStatus, hasProviderKey, isAgentEnabled, providerApiKeyEnv, type AgentStatus } from './featureFlag';
export { getUsage, recordTurn, resetUsage, isBudgetExceeded, type AgentUsage } from './usage';
export { setAgentConfig, getAgentConfig } from './configStore';
export { entryToEmbeddingText } from './embedText';
export {
  type Embedder,
  LocalTransformersEmbedder,
  getDefaultEmbedder,
  setDefaultEmbedder,
  DEFAULT_MODEL_ID,
  DEFAULT_DIM,
} from './embedder';
export {
  type EmbeddingsRecord,
  type EmbeddingsStore,
  EMBEDDINGS_STORE_PATH,
  emptyStore,
  hashEmbeddingText,
  loadEmbeddings,
  serializeStore,
  removeEntryFromStore,
  upsertEntryInStore,
  embedEntry,
  embedEntryFromMemory,
  embedAll,
} from './embeddings';
export { encodeFloat32, decodeFloat32, cosineSimilarity } from './storeFormat';
export { syncEmbeddingsAfterUpsert, syncEmbeddingsAfterRemove } from './embeddingsHook';
export { searchContent, clearSearchCache, type SearchHit, type SearchOptions } from './search';
export { buildSystemPrompt, type SystemPromptInput, type StyleExemplar } from './systemPrompt';
export {
  READ_ONLY_TOOLS,
  PROPOSAL_TOOLS,
  ALL_TOOLS,
  getToolHandler,
  getToolDefinitions,
  acceptProposal,
  type ToolHandler,
  type ToolContext,
  type ToolRunResult,
} from './tools';
export {
  type Proposal,
  type EditProposal,
  type CreateProposal,
  type AcceptResult,
  describeEditSummary,
  describeCreateSummary,
  fieldsToFormStrings,
  resolveEntryPath,
} from './proposals';
export { runChat, type ChatEvent, type RunChatInput } from './chat';
export {
  classifyAttachment,
  checkAttachmentSize,
  checkAttachmentCount,
  normalizeAttachments,
  wrapAttachmentText,
  type AttachmentKind,
  type RawAttachment,
  type NormalizedAttachmentsResult,
  type AttachmentDiagnostic,
} from './attachments';
export { chatRoute, chatStatusRoute } from './chatApi';
export { getChatProvider } from './providers';
export type {
  ChatProvider,
  ChatStreamInput,
  NormalizedMessage,
  NormalizedContentBlock,
  NormalizedTool,
  ProviderEvent,
} from './providers/types';
