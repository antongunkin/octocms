import { promises as fsPromises } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Embedder } from './embedder';
import { setDefaultEmbedder } from './embedder';
import type { AgentConfig } from './types';
import { EMBEDDINGS_STORE_PATH, emptyStore, serializeStore } from './embeddings';
import { syncEmbeddingsAfterRemove, syncEmbeddingsAfterUpsert } from './embeddingsHook';

class MockEmbedder implements Embedder {
  modelId = 'mock-embedder';
  dim = 4;
  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => {
      const v = new Float32Array(this.dim);
      for (let i = 0; i < t.length; i++) v[i % this.dim] += t.charCodeAt(i);
      return v;
    });
  }
}

class FailingEmbedder implements Embedder {
  modelId = 'failing';
  dim = 4;
  async embed(): Promise<Float32Array[]> {
    throw new Error('embedder boom');
  }
}

const enabledConfig: AgentConfig = {
  provider: { type: 'anthropic', model: 'm', pricing: { inputPerM: 0, outputPerM: 0 } },
  totalBudgetUSD: 0,
  maxInputTokens: 1,
  maxOutputTokens: 1,
  maxAttachmentBytes: 1,
  maxAttachmentsPerTurn: 1,
  maxProposalsPerTurn: 1,
} as unknown as AgentConfig;

const disabledConfig: AgentConfig = { ...enabledConfig } as AgentConfig;

const mockSiteConfig = {
  contentFolder: 'cms/content',
  collections: { post: { fields: { title: { format: 'string' } } } },
} as any;

describe('embeddingsHook', () => {
  let tmpRoot: string;
  let prevCwd: string;
  let prevAnthropicKey: string | undefined;

  beforeEach(async () => {
    prevCwd = process.cwd();
    tmpRoot = await fsPromises.mkdtemp(path.join(tmpdir(), 'oct-emb-hook-'));
    process.chdir(tmpRoot);
    setDefaultEmbedder(new MockEmbedder());

    // Enable agent for `enabledConfig`: Anthropic + an env var.
    prevAnthropicKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(async () => {
    process.chdir(prevCwd);
    setDefaultEmbedder(null);
    await fsPromises.rm(tmpRoot, { recursive: true, force: true });
    if (prevAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prevAnthropicKey;
  });

  describe('syncEmbeddingsAfterUpsert', () => {
    it('writes a new entry into the store on dev (local FS)', async () => {
      await syncEmbeddingsAfterUpsert({
        agentConfig: enabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-a.json',
        payload: { sys: { type: 'post' }, fields: { title: 'A' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });

      const raw = await fsPromises.readFile(path.join(tmpRoot, EMBEDDINGS_STORE_PATH), 'utf8');
      const store = JSON.parse(raw);
      expect(store.entries['cms/content/post/post-a.json']).toBeDefined();
      expect(store.entries['cms/content/post/post-a.json'].vec).toMatch(/^[A-Za-z0-9+/=]+$/);
    });

    it('is a no-op when the agent is disabled (no provider key)', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      await syncEmbeddingsAfterUpsert({
        agentConfig: disabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-a.json',
        payload: { sys: { type: 'post' }, fields: { title: 'A' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });

      await expect(fsPromises.access(path.join(tmpRoot, EMBEDDINGS_STORE_PATH))).rejects.toThrow();
    });

    it('swallows embedder failures and logs a warning (content writes never blocked)', async () => {
      setDefaultEmbedder(new FailingEmbedder());
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await expect(
        syncEmbeddingsAfterUpsert({
          agentConfig: enabledConfig,
          config: mockSiteConfig,
          entryPath: 'cms/content/post/post-a.json',
          payload: { fields: { title: 'A' } },
          companions: {},
          branch: undefined,
          isProduction: false,
        }),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledOnce();
      expect(warnSpy.mock.calls[0][0]).toContain('embeddings sync failed');
      warnSpy.mockRestore();
    });

    it('writes the canonical sorted-keys serialisation (deterministic Git diff)', async () => {
      await syncEmbeddingsAfterUpsert({
        agentConfig: enabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-z.json',
        payload: { fields: { title: 'Z' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });
      await syncEmbeddingsAfterUpsert({
        agentConfig: enabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-a.json',
        payload: { fields: { title: 'A' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });

      const raw = await fsPromises.readFile(path.join(tmpRoot, EMBEDDINGS_STORE_PATH), 'utf8');
      // Keys must appear in sorted order regardless of insertion order.
      const aIdx = raw.indexOf('post-a.json');
      const zIdx = raw.indexOf('post-z.json');
      expect(aIdx).toBeGreaterThan(0);
      expect(zIdx).toBeGreaterThan(aIdx);
      // Trailing newline (matches `serializeStore`).
      expect(raw.endsWith('\n')).toBe(true);
    });
  });

  describe('syncEmbeddingsAfterRemove', () => {
    it('drops the entry from the store and rewrites', async () => {
      // Seed: write a store with two entries by upserting both.
      await syncEmbeddingsAfterUpsert({
        agentConfig: enabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-a.json',
        payload: { fields: { title: 'A' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });
      await syncEmbeddingsAfterUpsert({
        agentConfig: enabledConfig,
        config: mockSiteConfig,
        entryPath: 'cms/content/post/post-b.json',
        payload: { fields: { title: 'B' } },
        companions: {},
        branch: undefined,
        isProduction: false,
      });

      await syncEmbeddingsAfterRemove({
        agentConfig: enabledConfig,
        entryPath: 'cms/content/post/post-a.json',
        branch: undefined,
        isProduction: false,
      });

      const raw = await fsPromises.readFile(path.join(tmpRoot, EMBEDDINGS_STORE_PATH), 'utf8');
      const store = JSON.parse(raw);
      expect(store.entries['cms/content/post/post-a.json']).toBeUndefined();
      expect(store.entries['cms/content/post/post-b.json']).toBeDefined();
    });

    it('is a no-op when the path is not in the store (no rewrite, no error)', async () => {
      // Pre-write a fixed store so we can verify it is untouched.
      const initial = serializeStore(emptyStore(new MockEmbedder()));
      const dest = path.join(tmpRoot, EMBEDDINGS_STORE_PATH);
      await fsPromises.mkdir(path.dirname(dest), { recursive: true });
      await fsPromises.writeFile(dest, initial, 'utf8');
      const beforeMtime = (await fsPromises.stat(dest)).mtimeMs;

      await syncEmbeddingsAfterRemove({
        agentConfig: enabledConfig,
        entryPath: 'cms/content/post/never-existed.json',
        branch: undefined,
        isProduction: false,
      });

      const afterRaw = await fsPromises.readFile(dest, 'utf8');
      expect(afterRaw).toBe(initial);
      const afterMtime = (await fsPromises.stat(dest)).mtimeMs;
      // No write happened, so the mtime should not have changed.
      expect(afterMtime).toBe(beforeMtime);
    });

    it('is a no-op when the agent is disabled', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      // No prior store exists; the call must not create one either.
      await syncEmbeddingsAfterRemove({
        agentConfig: disabledConfig,
        entryPath: 'cms/content/post/post-a.json',
        branch: undefined,
        isProduction: false,
      });
      await expect(fsPromises.access(path.join(tmpRoot, EMBEDDINGS_STORE_PATH))).rejects.toThrow();
    });
  });
});
