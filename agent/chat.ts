/**
 * Agent loop — drives one or more provider turns until the model says
 * `end_turn` or a budget cap is hit.
 *
 * The function is a single async generator. Callers (the SSE route handler)
 * await each event and forward it to the client. After every turn the loop
 * decides whether to run tools and feed results back as a new user message
 * (the `tool` role on our normalised wire — see provider adapters).
 */
import type { Config } from '../types';
import type {
  ChatProvider,
  NormalizedContentBlock,
  NormalizedMessage,
  NormalizedTool,
} from './providers/types';
import type { AgentConfig } from './types';
import type { Proposal } from './proposals';
import { estimateCostUSD } from './pricing';
import { recordTurn } from './usage';
import { getToolDefinitions, getToolHandler } from './tools';

export type ChatEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_use_start'; id: string; name: string }
  | { type: 'tool_use_input_delta'; id: string; partialJson: string }
  | { type: 'tool_use_complete'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; name: string; result: string; isError?: boolean }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'turn_stop'; stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other' }
  | { type: 'usage'; inputTokens: number; outputTokens: number; cachedInputTokens?: number; costUSDDelta: number; totalCostUSD: number }
  | { type: 'budget_exceeded'; reason: 'input_tokens' | 'output_tokens' | 'spend' | 'max_turns' | 'proposal_cap' }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type RunChatInput = {
  agentConfig: AgentConfig;
  config: Config;
  systemPrompt: string;
  messages: NormalizedMessage[];
  provider: ChatProvider;
  tools?: NormalizedTool[];
  branch?: string;
  /** Hard ceiling on agent loop iterations. Defaults to 10. */
  maxTurns?: number;
};

export async function* runChat(input: RunChatInput): AsyncGenerator<ChatEvent> {
  const tools = input.tools ?? getToolDefinitions();
  const maxTurns = input.maxTurns ?? 10;

  // Conversation state mutated across turns. We keep a copy so the caller's
  // array isn't mutated.
  const messages: NormalizedMessage[] = [...input.messages];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    const stream = input.provider.streamChat({
      messages,
      tools,
      systemPrompt: input.systemPrompt,
      maxOutputTokens: input.agentConfig.maxOutputTokens,
    });

    const assistantBlocks: NormalizedContentBlock[] = [];
    let currentText = '';
    const pendingToolCalls: { id: string; name: string; input: unknown }[] = [];
    let stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence' | 'other' = 'other';
    let usage = { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
    let errored = false;

    for await (const ev of stream) {
      if (ev.type === 'error') {
        yield { type: 'error', message: ev.message };
        errored = true;
        break;
      }
      if (ev.type === 'text_delta') {
        currentText += ev.text;
        yield ev;
        continue;
      }
      if (ev.type === 'tool_use_start') {
        if (currentText) {
          assistantBlocks.push({ type: 'text', text: currentText });
          currentText = '';
        }
        yield ev;
        continue;
      }
      if (ev.type === 'tool_use_input_delta') {
        yield ev;
        continue;
      }
      if (ev.type === 'tool_use_complete') {
        assistantBlocks.push({ type: 'tool_use', id: ev.id, name: ev.name, input: ev.input });
        pendingToolCalls.push({ id: ev.id, name: ev.name, input: ev.input });
        yield ev;
        continue;
      }
      if (ev.type === 'message_stop') {
        if (currentText) {
          assistantBlocks.push({ type: 'text', text: currentText });
          currentText = '';
        }
        stopReason = ev.stopReason;
        usage = {
          inputTokens: ev.usage.inputTokens,
          outputTokens: ev.usage.outputTokens,
          cachedInputTokens: ev.usage.cachedInputTokens ?? 0,
        };
      }
    }

    if (errored) return;

    // Persist assistant turn into conversation history for any follow-up turn.
    messages.push({ role: 'assistant', content: assistantBlocks });

    // Bookkeeping — budget + usage event
    totalInputTokens += usage.inputTokens;
    totalOutputTokens += usage.outputTokens;
    const costDelta = estimateCostUSD(input.agentConfig, usage.inputTokens, usage.outputTokens, usage.cachedInputTokens);
    const cumulative = recordTurn(input.agentConfig, {
      input: usage.inputTokens,
      output: usage.outputTokens,
      cachedInput: usage.cachedInputTokens,
    });
    yield {
      type: 'usage',
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cachedInputTokens: usage.cachedInputTokens,
      costUSDDelta: costDelta,
      totalCostUSD: cumulative.costUSD,
    };

    yield { type: 'turn_stop', stopReason };

    if (totalInputTokens > input.agentConfig.maxInputTokens) {
      yield { type: 'budget_exceeded', reason: 'input_tokens' };
      return;
    }
    if (totalOutputTokens > input.agentConfig.maxOutputTokens) {
      yield { type: 'budget_exceeded', reason: 'output_tokens' };
      return;
    }

    // No tools requested — we're done.
    if (pendingToolCalls.length === 0) {
      yield { type: 'done' };
      return;
    }

    // Run each tool sequentially so the model sees a consistent ordering for
    // tools that depend on a previous tool's effect (e.g. `proposeEdit` after
    // `getEntry`).
    let proposalsThisTurn = 0;
    const proposalCap = input.agentConfig.maxProposalsPerTurn;
    for (const call of pendingToolCalls) {
      const handler = getToolHandler(call.name);
      let result: string;
      let isError = false;
      let proposal: Proposal | undefined;
      if (!handler) {
        result = JSON.stringify({ error: `Unknown tool: ${call.name}` });
        isError = true;
      } else {
        try {
          const ret = await handler.run(call.input, {
            config: input.config,
            branch: input.branch,
            toolUseId: call.id,
          });
          if (typeof ret === 'string') {
            result = ret;
          } else {
            result = ret.message;
            proposal = ret.proposal;
          }
        } catch (err) {
          result = JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
          isError = true;
        }
      }

      if (proposal) {
        if (proposalsThisTurn >= proposalCap) {
          // Cap reached — drop the proposal and tell the model so it can stop
          // emitting more. The user already has `proposalCap` cards to deal with.
          result = JSON.stringify({
            ok: false,
            error: `Per-turn proposal cap reached (${proposalCap}). Stop emitting more — the user must accept or reject the existing cards before you propose anything else.`,
          });
          isError = true;
        } else {
          proposalsThisTurn += 1;
          // Stamp the wire-level toolUseId in case the handler used a placeholder.
          const stamped: Proposal = { ...proposal, toolUseId: call.id };
          yield { type: 'proposal', proposal: stamped };
        }
      }

      yield { type: 'tool_result', toolUseId: call.id, name: call.name, result, isError };
      messages.push({ role: 'tool', toolUseId: call.id, content: result, isError });
    }

    // Continue loop — feed tool results back to the model.
  }

  yield { type: 'budget_exceeded', reason: 'max_turns' };
}
