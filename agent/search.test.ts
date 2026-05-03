import { promises as fsPromises } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Config } from '../admin/types';
import { setConfig } from '../lib/configStore';

import type { Embedder } from './embedder';
import { setDefaultEmbedder } from './embedder';
import { encodeFloat32 } from './storeFormat';
import { clearSearchCache, searchContent } from './search';

const config = {
  projectName: 'test',
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: [],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { format: 'string', label: 'Title', entryTitle: true },
        body: { format: 'markdown', label: 'Body' },
      },
    },
    author: {
      label: 'Author',
      hasMany: true,
      fields: {
        name: { format: 'string', label: 'Name', entryTitle: true },
      },
    },
  },
} as unknown as Config;

/**
 * Embedder that yields fixed vectors keyed by exact text — gives us fully
 * deterministic cosine scores. The query and entry texts in each test are
 * tuned so we know exactly which entry should win.
 */
class StubEmbedder implements Embedder {
  modelId = 'stub';
  dim = 4;
  table = new Map<string, number[]>();

  async embed(texts: string[]): Promise<Float32Array[]> {
    return texts.map((t) => {
      const v = this.table.get(t);
      if (!v) throw new Error(`StubEmbedder: missing vector for ${JSON.stringify(t)}`);
      return Float32Array.from(v);
    });
  }
}

async function writeStore(workdir: string, dim: number, entries: Record<string, number[]>): Promise<void> {
  const storePath = path.join(workdir, 'cms', '__generated__', 'embeddings.json');
  await fsPromises.mkdir(path.dirname(storePath), { recursive: true });
  const serialised = {
    model: 'stub',
    dim,
    entries: Object.fromEntries(
      Object.entries(entries).map(([key, vec]) => [key, { hash: 'h', vec: encodeFloat32(Float32Array.from(vec)) }]),
    ),
  };
  await fsPromises.writeFile(storePath, JSON.stringify(serialised), 'utf8');
}

async function writeEntry(workdir: string, relPath: string, payload: unknown): Promise<void> {
  const abs = path.join(workdir, relPath);
  await fsPromises.mkdir(path.dirname(abs), { recursive: true });
  await fsPromises.writeFile(abs, JSON.stringify(payload), 'utf8');
}

describe('searchContent', () => {
  let workdir: string;
  let originalCwd: string;
  let stub: StubEmbedder;

  beforeEach(async () => {
    originalCwd = process.cwd();
    workdir = await fsPromises.mkdtemp(path.join(tmpdir(), 'octocms-search-'));
    process.chdir(workdir);
    setConfig(config);
    stub = new StubEmbedder();
    setDefaultEmbedder(stub);
    clearSearchCache();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    setDefaultEmbedder(null);
    clearSearchCache();
    await fsPromises.rm(workdir, { recursive: true, force: true });
  });

  it('returns top-K hits ranked by cosine similarity', async () => {
    // Query is identical to entry A → cosine 1.0; B is orthogonal → 0.
    stub.table.set('alpha', [1, 0, 0, 0]);
    await writeStore(workdir, 4, {
      'cms/content/post/post-alpha.json': [1, 0, 0, 0],
      'cms/content/post/post-beta.json': [0, 1, 0, 0],
    });
    await writeEntry(workdir, 'cms/content/post/post-alpha.json', {
      sys: { type: 'post' },
      fields: { title: 'Alpha', body: 'an alpha body' },
    });
    await writeEntry(workdir, 'cms/content/post/post-beta.json', {
      sys: { type: 'post' },
      fields: { title: 'Beta', body: 'a beta body' },
    });

    const hits = await searchContent('alpha', { k: 2 });
    expect(hits).toHaveLength(2);
    expect(hits[0].path).toBe('cms/content/post/post-alpha.json');
    expect(hits[0].score).toBeCloseTo(1, 5);
    expect(hits[0].title).toBe('Alpha');
    expect(hits[0].collection).toBe('post');
    expect(hits[0].id).toBe('post-alpha');
    expect(hits[1].path).toBe('cms/content/post/post-beta.json');
    expect(hits[1].score).toBeCloseTo(0, 5);
  });

  it('respects the k limit', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    await writeStore(workdir, 4, {
      'cms/content/post/p1.json': [1, 0, 0, 0],
      'cms/content/post/p2.json': [0.9, 0.1, 0, 0],
      'cms/content/post/p3.json': [0, 1, 0, 0],
    });
    await writeEntry(workdir, 'cms/content/post/p1.json', { sys: { type: 'post' }, fields: { title: 'one' } });
    await writeEntry(workdir, 'cms/content/post/p2.json', { sys: { type: 'post' }, fields: { title: 'two' } });
    await writeEntry(workdir, 'cms/content/post/p3.json', { sys: { type: 'post' }, fields: { title: 'three' } });

    const hits = await searchContent('q', { k: 2 });
    expect(hits.map((h) => h.id)).toEqual(['p1', 'p2']);
  });

  it('filters by collection', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    await writeStore(workdir, 4, {
      'cms/content/post/p1.json': [1, 0, 0, 0],
      'cms/content/author/a1.json': [0.9, 0.1, 0, 0],
    });
    await writeEntry(workdir, 'cms/content/post/p1.json', { sys: { type: 'post' }, fields: { title: 'P' } });
    await writeEntry(workdir, 'cms/content/author/a1.json', { sys: { type: 'author' }, fields: { name: 'A' } });

    const hits = await searchContent('q', { k: 5, collection: 'author' });
    expect(hits).toHaveLength(1);
    expect(hits[0].collection).toBe('author');
    expect(hits[0].id).toBe('a1');
    expect(hits[0].title).toBe('A');
  });

  it('returns [] for empty/whitespace queries without calling the embedder', async () => {
    stub.table.set('never-called', [1, 1, 1, 1]);
    await writeStore(workdir, 4, { 'cms/content/post/p.json': [1, 0, 0, 0] });
    expect(await searchContent('', { k: 5 })).toEqual([]);
    expect(await searchContent('   ', { k: 5 })).toEqual([]);
  });

  it('returns [] when the store is empty', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    await writeStore(workdir, 4, {});
    expect(await searchContent('q', { k: 5 })).toEqual([]);
  });

  it('skips records whose vector dim does not match the query', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    // Record's vector is dim=2, query is dim=4 → must be skipped, not throw.
    const storePath = path.join(workdir, 'cms', '__generated__', 'embeddings.json');
    await fsPromises.mkdir(path.dirname(storePath), { recursive: true });
    await fsPromises.writeFile(
      storePath,
      JSON.stringify({
        model: 'stub',
        dim: 4,
        entries: {
          'cms/content/post/bad.json': { hash: 'h', vec: encodeFloat32(Float32Array.from([1, 0])) },
          'cms/content/post/good.json': { hash: 'h', vec: encodeFloat32(Float32Array.from([1, 0, 0, 0])) },
        },
      }),
      'utf8',
    );
    await writeEntry(workdir, 'cms/content/post/good.json', { sys: { type: 'post' }, fields: { title: 'good' } });

    const hits = await searchContent('q', { k: 5 });
    expect(hits).toHaveLength(1);
    expect(hits[0].id).toBe('good');
  });

  it('caches the store across calls within the TTL', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    await writeStore(workdir, 4, { 'cms/content/post/p.json': [1, 0, 0, 0] });
    await writeEntry(workdir, 'cms/content/post/p.json', { sys: { type: 'post' }, fields: { title: 'orig' } });

    const first = await searchContent('q', { k: 1 });
    expect(first[0].title).toBe('orig');

    // Mutate the store on disk; cached result should still serve the first hit
    // while subsequent entry-payload reads see the updated title (cache covers
    // the embeddings store, not the entry payload reads).
    await writeStore(workdir, 4, {
      'cms/content/post/different.json': [1, 0, 0, 0],
    });

    const cachedHit = await searchContent('q', { k: 1 });
    expect(cachedHit[0].path).toBe('cms/content/post/p.json');

    // noCache opts out and picks up the new store.
    await writeEntry(workdir, 'cms/content/post/different.json', {
      sys: { type: 'post' },
      fields: { title: 'fresh' },
    });
    const fresh = await searchContent('q', { k: 1, noCache: true });
    expect(fresh[0].path).toBe('cms/content/post/different.json');
    expect(fresh[0].title).toBe('fresh');
  });

  it('builds excerpts from the first non-title text field', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    await writeStore(workdir, 4, { 'cms/content/post/p.json': [1, 0, 0, 0] });
    await writeEntry(workdir, 'cms/content/post/p.json', {
      sys: { type: 'post' },
      fields: { title: 'T', body: 'A short markdown body' },
    });
    const hits = await searchContent('q', { k: 1 });
    expect(hits[0].excerpt).toBe('A short markdown body');
  });

  it('falls back to filename stem when the entry payload cannot be read', async () => {
    stub.table.set('q', [1, 0, 0, 0]);
    // Store references a file that does not exist on disk.
    await writeStore(workdir, 4, { 'cms/content/post/missing.json': [1, 0, 0, 0] });
    const hits = await searchContent('q', { k: 1 });
    expect(hits).toHaveLength(1);
    expect(hits[0].title).toBe('missing');
    expect(hits[0].excerpt).toBe('');
  });
});
