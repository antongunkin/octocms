/**
 * Unit tests for the Phase 4 proposal layer.
 *
 * Covers:
 *   - `acceptProposal` — both `edit` and `create` flows, validation re-run,
 *     and error propagation from `saveFile` / `newFile`.
 *   - `proposeEdit` and `proposeNewEntry` tool handlers — they must validate
 *     against the schema, surface `fieldErrors`, and emit a proposal payload
 *     with the wire-level toolUseId stamped in by the chat loop.
 *   - The chat loop's `proposal` event emission and `maxProposalsPerTurn` cap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../types';
import type { ChatProvider, ProviderEvent, ChatStreamInput } from './providers/types';
import type { AgentConfig } from './types';

const minimalConfig: Config = {
  projectName: 'T',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true, entryTitle: true },
        body: { label: 'Body', format: 'text', required: false },
      },
    },
  },
} as unknown as Config;

const agentConfig: AgentConfig = {
  provider: { type: 'local', model: 'test', baseURL: 'http://x' },
  maxInputTokens: 100_000,
  maxOutputTokens: 10_000,
  maxProposalsPerTurn: 3,
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

async function collect<T>(iter: AsyncIterable<T>): Promise<T[]> {
  const out: T[] = [];
  for await (const v of iter) out.push(v);
  return out;
}

beforeEach(async () => {
  vi.resetModules();
  // Reset usage so spend caps don't leak between tests.
  const u = await import('./usage');
  u.resetUsage();
  // Make `getConfig()` return our minimal schema so `validateEntryFields` works.
  vi.doMock('../lib/configStore', () => ({
    getConfig: () => minimalConfig,
    setConfig: vi.fn(),
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('proposeEdit tool', () => {
  it('returns fieldErrors on schema violation and does NOT emit a proposal', async () => {
    vi.doMock('../admin/actions/files', () => ({
      getContentFiles: vi.fn().mockResolvedValue(['cms/content/post/post-abc.json']),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'abc', type: 'post' }, fields: { title: 'Old' } }),
    }));
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));

    const { getToolHandler } = await import('./tools');
    const handler = getToolHandler('proposeEdit')!;
    const ret = await handler.run(
      {
        entryId: 'post-abc',
        collection: 'post',
        // Required `title` blanked — should fail validation.
        fieldChanges: { title: '' },
        reasoning: 'why',
      },
      { config: minimalConfig, toolUseId: 'tu_1' },
    );

    expect(typeof ret).toBe('string');
    const parsed = JSON.parse(ret as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.fieldErrors).toBeDefined();
    expect(parsed.fieldErrors.title).toMatch(/required/i);
  });

  it('emits a proposal with the merged-and-validated payload', async () => {
    vi.doMock('../admin/actions/files', () => ({
      getContentFiles: vi.fn().mockResolvedValue(['cms/content/post/post-abc.json']),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'abc', type: 'post' }, fields: { title: 'Old', body: 'Body' } }),
    }));
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));

    const { getToolHandler } = await import('./tools');
    const handler = getToolHandler('proposeEdit')!;
    const ret = await handler.run(
      {
        entryId: 'post-abc',
        collection: 'post',
        fieldChanges: { title: 'New title' },
        reasoning: 'fixing typo',
      },
      { config: minimalConfig, toolUseId: 'tu_1' },
    );

    expect(typeof ret).toBe('object');
    if (typeof ret === 'string') return; // type narrow for TS
    expect(ret.proposal).toBeDefined();
    expect(ret.proposal!.kind).toBe('edit');
    if (ret.proposal!.kind !== 'edit') return;
    expect(ret.proposal!.toolUseId).toBe('tu_1');
    expect(ret.proposal!.entryPath).toBe('cms/content/post/post-abc.json');
    expect(ret.proposal!.entryId).toBe('post-abc');
    expect(ret.proposal!.fieldChanges).toEqual({ title: 'New title' });
    expect(ret.proposal!.reasoning).toBe('fixing typo');
    const msg = JSON.parse(ret.message);
    expect(msg.ok).toBe(true);
    expect(msg.awaitingApproval).toBe(true);
  });

  it('errors cleanly when the entry id does not exist', async () => {
    vi.doMock('../admin/actions/files', () => ({
      getContentFiles: vi.fn().mockResolvedValue([]),
      getFile: vi.fn(),
    }));
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));

    const { getToolHandler } = await import('./tools');
    const handler = getToolHandler('proposeEdit')!;
    const ret = await handler.run(
      { entryId: 'post-missing', collection: 'post', fieldChanges: { title: 'x' }, reasoning: 'r' },
      { config: minimalConfig, toolUseId: 'tu_1' },
    );
    const parsed = JSON.parse(ret as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/not found/i);
  });
});

describe('proposeNewEntry tool', () => {
  it('returns fieldErrors when required fields are missing', async () => {
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./tools');
    const handler = getToolHandler('proposeNewEntry')!;
    const ret = await handler.run(
      { collection: 'post', fields: { body: 'just body' }, reasoning: 'r' },
      { config: minimalConfig, toolUseId: 'tu_1' },
    );
    const parsed = JSON.parse(ret as string);
    expect(parsed.ok).toBe(false);
    expect(parsed.fieldErrors.title).toMatch(/required/i);
  });

  it('emits a create proposal when validation passes', async () => {
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./tools');
    const handler = getToolHandler('proposeNewEntry')!;
    const ret = await handler.run(
      { collection: 'post', fields: { title: 'Hi', body: 'Body' }, reasoning: 'why' },
      { config: minimalConfig, toolUseId: 'tu_2' },
    );
    if (typeof ret === 'string') {
      throw new Error(`expected proposal, got string ${ret}`);
    }
    expect(ret.proposal!.kind).toBe('create');
    if (ret.proposal!.kind !== 'create') return;
    expect(ret.proposal!.collection).toBe('post');
    expect(ret.proposal!.fields).toEqual({ title: 'Hi', body: 'Body' });
    expect(ret.proposal!.toolUseId).toBe('tu_2');
  });
});

describe('acceptProposal — edit', () => {
  it('runs saveFile with merged fields and returns the entry path', async () => {
    const saveFile = vi.fn().mockResolvedValue({ success: true });
    const getFile = vi.fn().mockResolvedValue({
      sys: { id: 'abc', type: 'post', status: 'merged' },
      fields: { title: 'Old', body: 'Body' },
    });
    vi.doMock('../admin/actions/files', () => ({ saveFile, newFile: vi.fn(), getFile, getContentFiles: vi.fn() }));

    const { acceptProposal } = await import('./tools');
    const result = await acceptProposal({
      id: 'p1',
      kind: 'edit',
      toolUseId: 'tu',
      collection: 'post',
      entryPath: 'cms/content/post/post-abc.json',
      entryId: 'post-abc',
      fieldChanges: { title: 'New title' },
      reasoning: 'r',
      summary: 's',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entryPath).toBe('cms/content/post/post-abc.json');
    expect(saveFile).toHaveBeenCalledTimes(1);
    const [payload, fileName] = saveFile.mock.calls[0];
    expect(fileName).toBe('cms/content/post/post-abc.json');
    expect(payload.fields.title).toBe('New title');
    expect(payload.fields.body).toBe('Body'); // unchanged field merged from existing
    expect(payload.sys.id).toBe('abc');
  });

  it('forwards saveFile validation errors', async () => {
    vi.doMock('../admin/actions/files', () => ({
      saveFile: vi.fn().mockResolvedValue({
        success: false,
        error: 'Title is required',
        fieldErrors: { title: 'Title is required' },
      }),
      newFile: vi.fn(),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'a', type: 'post' }, fields: { title: 'x' } }),
      getContentFiles: vi.fn(),
    }));

    const { acceptProposal } = await import('./tools');
    const result = await acceptProposal({
      id: 'p1',
      kind: 'edit',
      toolUseId: 'tu',
      collection: 'post',
      entryPath: 'cms/content/post/post-a.json',
      entryId: 'post-a',
      fieldChanges: { title: '' },
      reasoning: 'r',
      summary: 's',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('Title is required');
    expect(result.fieldErrors).toEqual({ title: 'Title is required' });
  });
});

describe('acceptProposal — create', () => {
  it('calls newFile then saveFile with proposed fields', async () => {
    const newFile = vi.fn().mockResolvedValue({ success: true, path: 'cms/content/post/post-new.json' });
    const saveFile = vi.fn().mockResolvedValue({ success: true });
    const getFile = vi.fn().mockResolvedValue({
      sys: { id: 'new', type: 'post', status: 'draft' },
      fields: {},
    });
    vi.doMock('../admin/actions/files', () => ({ saveFile, newFile, getFile, getContentFiles: vi.fn() }));

    const { acceptProposal } = await import('./tools');
    const result = await acceptProposal({
      id: 'p1',
      kind: 'create',
      toolUseId: 'tu',
      collection: 'post',
      fields: { title: 'Brand new', body: 'Body' },
      reasoning: 'r',
      summary: 's',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.entryPath).toBe('cms/content/post/post-new.json');
    expect(newFile).toHaveBeenCalledWith('post');
    expect(saveFile).toHaveBeenCalledTimes(1);
    expect(saveFile.mock.calls[0][0].fields.title).toBe('Brand new');
    expect(saveFile.mock.calls[0][0].fields.body).toBe('Body');
  });

  it('returns the newFile error when creation fails', async () => {
    vi.doMock('../admin/actions/files', () => ({
      saveFile: vi.fn(),
      newFile: vi.fn().mockResolvedValue({ success: false, error: 'GitHub 422' }),
      getFile: vi.fn(),
      getContentFiles: vi.fn(),
    }));
    const { acceptProposal } = await import('./tools');
    const result = await acceptProposal({
      id: 'p1',
      kind: 'create',
      toolUseId: 'tu',
      collection: 'post',
      fields: { title: 't' },
      reasoning: 'r',
      summary: 's',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('GitHub 422');
  });
});

describe('runChat — proposal events', () => {
  it('yields a `proposal` event before the corresponding tool_result', async () => {
    vi.doMock('../admin/actions/files', () => ({
      getContentFiles: vi.fn().mockResolvedValue(['cms/content/post/post-abc.json']),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'abc', type: 'post' }, fields: { title: 'Old' } }),
    }));
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));

    const { runChat } = await import('./chat');
    const provider = makeProvider([
      [
        { type: 'tool_use_start', id: 'tu_e1', name: 'proposeEdit' },
        {
          type: 'tool_use_complete',
          id: 'tu_e1',
          name: 'proposeEdit',
          input: {
            entryId: 'post-abc',
            collection: 'post',
            fieldChanges: { title: 'New' },
            reasoning: 'because',
          },
        },
        { type: 'message_stop', stopReason: 'tool_use', usage: { inputTokens: 1, outputTokens: 1 } },
      ],
      [
        { type: 'text_delta', text: 'done' },
        { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } },
      ],
    ]);

    const events = await collect(
      runChat({
        agentConfig,
        config: minimalConfig,
        systemPrompt: 's',
        messages: [{ role: 'user', content: 'fix it' }],
        provider,
      }),
    );

    const proposalIdx = events.findIndex((e) => e.type === 'proposal');
    const toolResultIdx = events.findIndex((e) => e.type === 'tool_result');
    expect(proposalIdx).toBeGreaterThan(-1);
    expect(toolResultIdx).toBeGreaterThan(proposalIdx);

    const proposalEvent = events[proposalIdx] as { type: 'proposal'; proposal: { toolUseId: string; kind: string } };
    expect(proposalEvent.proposal.kind).toBe('edit');
    expect(proposalEvent.proposal.toolUseId).toBe('tu_e1'); // stamped by the loop
  });

  it('drops proposals after maxProposalsPerTurn and surfaces an error in the tool result', async () => {
    vi.doMock('../admin/actions/files', () => ({
      getContentFiles: vi
        .fn()
        .mockResolvedValue([
          'cms/content/post/post-a.json',
          'cms/content/post/post-b.json',
          'cms/content/post/post-c.json',
          'cms/content/post/post-d.json',
        ]),
      getFile: vi.fn().mockResolvedValue({ sys: { id: 'x', type: 'post' }, fields: { title: 'T' } }),
    }));
    vi.doMock('./search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));

    const { runChat } = await import('./chat');
    const cap2: AgentConfig = { ...agentConfig, maxProposalsPerTurn: 2 };

    const proposalCalls = ['post-a', 'post-b', 'post-c', 'post-d'].map((id, i) => [
      { type: 'tool_use_start', id: `tu_${i}`, name: 'proposeEdit' } as ProviderEvent,
      {
        type: 'tool_use_complete',
        id: `tu_${i}`,
        name: 'proposeEdit',
        input: { entryId: id, collection: 'post', fieldChanges: { title: 'X' }, reasoning: 'r' },
      } as ProviderEvent,
    ]);
    const provider = makeProvider([
      [
        ...proposalCalls.flat(),
        { type: 'message_stop', stopReason: 'tool_use', usage: { inputTokens: 1, outputTokens: 1 } },
      ],
      [
        { type: 'text_delta', text: 'ok' },
        { type: 'message_stop', stopReason: 'end_turn', usage: { inputTokens: 1, outputTokens: 1 } },
      ],
    ]);

    const events = await collect(
      runChat({
        agentConfig: cap2,
        config: minimalConfig,
        systemPrompt: '',
        messages: [{ role: 'user', content: 'edit four posts' }],
        provider,
      }),
    );

    const proposals = events.filter((e) => e.type === 'proposal');
    expect(proposals).toHaveLength(2);

    // Tool results 3 and 4 should be capped errors; 1 and 2 should be ok proposals.
    const toolResults = events.filter((e) => e.type === 'tool_result') as Array<{
      type: 'tool_result';
      result: string;
      isError?: boolean;
    }>;
    expect(toolResults).toHaveLength(4);
    expect(toolResults[2].isError).toBe(true);
    expect(JSON.parse(toolResults[2].result).error).toMatch(/cap reached/i);
    expect(toolResults[3].isError).toBe(true);
  });
});
