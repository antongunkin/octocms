import { promises as fsPromises } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Embedder } from './embedder';
import { setDefaultEmbedder } from './embedder';
import {
  embedAll,
  embedEntry,
  embedEntryFromMemory,
  emptyStore,
  hashEmbeddingText,
  loadEmbeddings,
  removeEntryFromStore,
  serializeStore,
  upsertEntryInStore,
} from './embeddings';
import { decodeFloat32, encodeFloat32 } from './storeFormat';

/** Deterministic stand-in for `LocalTransformersEmbedder` — no model load. */
class MockEmbedder implements Embedder {
  modelId = 'mock-embedder';
  dim = 4;
  callCount = 0;
  texts: string[] = [];

  async embed(texts: string[]): Promise<Float32Array[]> {
    this.callCount++;
    this.texts.push(...texts);
    return texts.map((t) => {
      const v = new Float32Array(this.dim);
      // simple deterministic mapping — sum of char codes per dim slot
      for (let i = 0; i < t.length; i++) v[i % this.dim] += t.charCodeAt(i);
      return v;
    });
  }
}

const mockCollections = {
  post: {
    fields: {
      title: { format: 'string' },
      body: { format: 'markdown' },
    },
  },
} as any;

describe('hashEmbeddingText', () => {
  it('is deterministic for the same input', () => {
    expect(hashEmbeddingText('hello')).toBe(hashEmbeddingText('hello'));
  });

  it('differs for different inputs', () => {
    expect(hashEmbeddingText('hello')).not.toBe(hashEmbeddingText('world'));
  });

  it('produces a 64-char hex string (sha256)', () => {
    expect(hashEmbeddingText('anything')).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('upsertEntryInStore', () => {
  it('adds a new entry', () => {
    const store = emptyStore();
    const next = upsertEntryInStore(store, 'cms/content/post/p1.json', { hash: 'h1', vec: 'AAA' });
    expect(next.entries['cms/content/post/p1.json']).toEqual({ hash: 'h1', vec: 'AAA' });
  });

  it('does not mutate the input store', () => {
    const store = emptyStore();
    upsertEntryInStore(store, 'a', { hash: 'h', vec: 'v' });
    expect(store.entries).toEqual({});
  });

  it('replaces an existing entry', () => {
    const store = upsertEntryInStore(emptyStore(), 'a', { hash: 'h1', vec: 'v1' });
    const next = upsertEntryInStore(store, 'a', { hash: 'h2', vec: 'v2' });
    expect(next.entries['a']).toEqual({ hash: 'h2', vec: 'v2' });
  });

  it('normalises Windows path separators', () => {
    const next = upsertEntryInStore(emptyStore(), 'cms\\content\\post\\p1.json', { hash: 'h', vec: 'v' });
    expect(next.entries['cms/content/post/p1.json']).toEqual({ hash: 'h', vec: 'v' });
  });
});

describe('removeEntryFromStore', () => {
  it('removes an existing entry', () => {
    const store = upsertEntryInStore(emptyStore(), 'a', { hash: 'h', vec: 'v' });
    const next = removeEntryFromStore(store, 'a');
    expect(next.entries).toEqual({});
  });

  it('returns the same store when the path is not present', () => {
    const store = upsertEntryInStore(emptyStore(), 'a', { hash: 'h', vec: 'v' });
    const next = removeEntryFromStore(store, 'missing');
    expect(next).toBe(store);
  });

  it('does not mutate the input store', () => {
    const store = upsertEntryInStore(emptyStore(), 'a', { hash: 'h', vec: 'v' });
    removeEntryFromStore(store, 'a');
    expect(store.entries['a']).toEqual({ hash: 'h', vec: 'v' });
  });
});

describe('serializeStore', () => {
  it('sorts entry keys for stable diffs', () => {
    let store = emptyStore();
    store = upsertEntryInStore(store, 'b', { hash: 'h', vec: 'v' });
    store = upsertEntryInStore(store, 'a', { hash: 'h', vec: 'v' });
    store = upsertEntryInStore(store, 'c', { hash: 'h', vec: 'v' });
    const json = serializeStore(store);
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed.entries)).toEqual(['a', 'b', 'c']);
  });

  it('emits a trailing newline', () => {
    expect(serializeStore(emptyStore()).endsWith('\n')).toBe(true);
  });

  it('preserves model + dim header fields', () => {
    const store = { ...emptyStore(), model: 'm', dim: 16 };
    const parsed = JSON.parse(serializeStore(store));
    expect(parsed.model).toBe('m');
    expect(parsed.dim).toBe(16);
  });
});

describe('loadEmbeddings', () => {
  let workdir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    workdir = await fsPromises.mkdtemp(path.join(tmpdir(), 'octocms-emb-'));
    process.chdir(workdir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await fsPromises.rm(workdir, { recursive: true, force: true });
  });

  it('returns an empty store when the file is missing', async () => {
    const store = await loadEmbeddings();
    expect(store.entries).toEqual({});
  });

  it('parses a well-formed store from disk', async () => {
    const expected = {
      model: 'Xenova/bge-small-en-v1.5',
      dim: 384,
      entries: { foo: { hash: 'h', vec: 'v' } },
    };
    await fsPromises.mkdir(path.join(workdir, 'cms', '__generated__'), { recursive: true });
    await fsPromises.writeFile(
      path.join(workdir, 'cms', '__generated__', 'embeddings.json'),
      JSON.stringify(expected),
      'utf8',
    );
    const store = await loadEmbeddings();
    expect(store).toEqual(expected);
  });

  it('returns an empty store when the JSON is malformed', async () => {
    await fsPromises.mkdir(path.join(workdir, 'cms', '__generated__'), { recursive: true });
    await fsPromises.writeFile(path.join(workdir, 'cms', '__generated__', 'embeddings.json'), '{not json', 'utf8');
    const store = await loadEmbeddings();
    expect(store.entries).toEqual({});
  });
});

describe('embedEntry / embedAll (with mock embedder)', () => {
  let workdir: string;
  let originalCwd: string;
  let mock: MockEmbedder;

  beforeEach(async () => {
    originalCwd = process.cwd();
    workdir = await fsPromises.mkdtemp(path.join(tmpdir(), 'octocms-emb-'));
    process.chdir(workdir);
    mock = new MockEmbedder();
    setDefaultEmbedder(mock);

    await fsPromises.mkdir(path.join(workdir, 'cms', 'content', 'post'), { recursive: true });
    await fsPromises.writeFile(
      path.join(workdir, 'cms', 'content', 'post', 'post-1.json'),
      JSON.stringify({ sys: { id: '1', type: 'post' }, fields: { title: 'First' } }),
      'utf8',
    );
    await fsPromises.writeFile(path.join(workdir, 'cms', 'content', 'post', 'post-1.body.md'), '# Hello world', 'utf8');
  });

  afterEach(async () => {
    setDefaultEmbedder(null);
    process.chdir(originalCwd);
    await fsPromises.rm(workdir, { recursive: true, force: true });
  });

  it('embeds an entry from disk and merges companion content', async () => {
    const result = await embedEntry('cms/content/post/post-1.json', { collections: mockCollections });
    expect(result).not.toBeNull();
    expect(result!.skipped).toBe(false);
    expect(result!.vec.length).toBe(mock.dim);
    expect(mock.callCount).toBe(1);
    // Embedded text should include both the JSON title and the companion body
    expect(mock.texts[0]).toContain('title: First');
    expect(mock.texts[0]).toContain('body: # Hello world');
  });

  it('skips re-embedding when the hash matches the existing record', async () => {
    const first = await embedEntry('cms/content/post/post-1.json', { collections: mockCollections });
    const store = upsertEntryInStore(emptyStore(mock), 'cms/content/post/post-1.json', {
      hash: first!.hash,
      vec: encodeFloat32(first!.vec),
    });

    mock.callCount = 0;
    const second = await embedEntry('cms/content/post/post-1.json', { collections: mockCollections, store });
    expect(second!.skipped).toBe(true);
    expect(mock.callCount).toBe(0);
    // Vector survives the round-trip
    expect(Array.from(second!.vec)).toEqual(Array.from(first!.vec));
  });

  it('re-embeds when the dim has changed (model swap)', async () => {
    const first = await embedEntry('cms/content/post/post-1.json', { collections: mockCollections });
    const store = upsertEntryInStore(
      { model: 'old', dim: 999, entries: {} },
      'cms/content/post/post-1.json',
      { hash: first!.hash, vec: encodeFloat32(first!.vec) },
    );
    mock.callCount = 0;
    const second = await embedEntry('cms/content/post/post-1.json', { collections: mockCollections, store });
    expect(second!.skipped).toBe(false);
    expect(mock.callCount).toBe(1);
  });

  it('returns null for missing files', async () => {
    const result = await embedEntry('cms/content/post/missing.json', { collections: mockCollections });
    expect(result).toBeNull();
  });

  it('embedAll batches across paths and reuses existing records', async () => {
    await fsPromises.writeFile(
      path.join(workdir, 'cms', 'content', 'post', 'post-2.json'),
      JSON.stringify({ sys: { id: '2', type: 'post' }, fields: { title: 'Second' } }),
      'utf8',
    );
    await fsPromises.writeFile(path.join(workdir, 'cms', 'content', 'post', 'post-2.body.md'), 'content two', 'utf8');

    const first = await embedAll(['cms/content/post/post-1.json', 'cms/content/post/post-2.json'], {
      collections: mockCollections,
    });
    expect(Object.keys(first.entries).sort()).toEqual([
      'cms/content/post/post-1.json',
      'cms/content/post/post-2.json',
    ]);
    expect(first.dim).toBe(mock.dim);
    expect(first.model).toBe(mock.modelId);

    // Re-run with previous as cache → both are skipped
    mock.callCount = 0;
    const second = await embedAll(['cms/content/post/post-1.json', 'cms/content/post/post-2.json'], {
      collections: mockCollections,
      previous: first,
    });
    expect(mock.callCount).toBe(0);
    expect(second.entries).toEqual(first.entries);
  });
});

describe('embedEntryFromMemory', () => {
  let mock: MockEmbedder;
  beforeEach(() => {
    mock = new MockEmbedder();
    setDefaultEmbedder(mock);
  });
  afterEach(() => {
    setDefaultEmbedder(null);
  });

  it('returns a base64-encoded record matching the produced vector', async () => {
    const { record, vec } = await embedEntryFromMemory({ fields: { title: 'Hi' } }, { body: 'world' });
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.vec).toBe(encodeFloat32(vec));
    expect(Array.from(decodeFloat32(record.vec))).toEqual(Array.from(vec));
  });

  it('includes companion content in the embed text', async () => {
    await embedEntryFromMemory({ fields: { title: 'Hi' } }, { body: 'companion-text-here' });
    expect(mock.texts[0]).toContain('companion-text-here');
  });
});
