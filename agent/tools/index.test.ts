import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Config } from '../../types';
import type { ToolContext, ToolRunResult } from './index';

/** Read-only tools always return a string; helper to assert that for tests. */
function asString(r: ToolRunResult): string {
  return typeof r === 'string' ? r : r.message;
}

const minimalConfig: Config = {
  projectName: 'T',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Posts',
      hasMany: true,
      fields: { title: { label: 'Title', format: 'string', required: true, entryTitle: true } },
    },
  },
} as unknown as Config;

const ctx: ToolContext = { config: minimalConfig };

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchContent tool', () => {
  it('rejects empty queries with a structured error', async () => {
    vi.doMock('../search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('searchContent')!;
    const result = await handler.run({ query: '   ' }, ctx);
    expect(JSON.parse(asString(result)).error).toMatch(/non-empty/);
  });

  it('forwards options and serialises hits', async () => {
    const stub = vi.fn().mockResolvedValue([
      { id: 'post-a', path: 'cms/content/post/post-a.json', collection: 'post', score: 0.91234, title: 'A', excerpt: 'a!' },
    ]);
    vi.doMock('../search', () => ({ searchContent: stub, clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('searchContent')!;
    const result = await handler.run({ query: 'A', k: 4, collection: 'post' }, ctx);
    const payload = JSON.parse(asString(result));
    expect(payload.results).toHaveLength(1);
    expect(payload.results[0].score).toBe(0.9123);
    expect(stub).toHaveBeenCalledWith('A', expect.objectContaining({ k: 4, collection: 'post' }));
  });

  it('returns a no-results note when the index is empty', async () => {
    vi.doMock('../search', () => ({ searchContent: vi.fn().mockResolvedValue([]), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('searchContent')!;
    const result = await handler.run({ query: 'A' }, ctx);
    const payload = JSON.parse(asString(result));
    expect(payload.results).toEqual([]);
    expect(payload.note).toContain('No results');
  });
});

describe('findEntryForDocument tool', () => {
  it('rejects empty document text', async () => {
    vi.doMock('../search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('findEntryForDocument')!;
    const result = await handler.run({ documentText: '' }, ctx);
    expect(JSON.parse(asString(result)).error).toMatch(/non-empty/);
  });

  it('falls back to search when no URL hint is provided', async () => {
    const stub = vi.fn().mockResolvedValue([
      { id: 'post-a', path: 'cms/content/post/post-a.json', collection: 'post', score: 0.85, title: 'A', excerpt: 'ex' },
    ]);
    vi.doMock('../search', () => ({ searchContent: stub, clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('findEntryForDocument')!;
    const result = await handler.run({ documentText: 'document body about X', k: 3 }, ctx);
    const payload = JSON.parse(asString(result));
    expect(payload.candidates).toHaveLength(1);
    expect(payload.candidates[0]).toMatchObject({ id: 'post-a', matchedBy: 'search', score: 0.85 });
    expect(stub).toHaveBeenCalledWith('document body about X', expect.objectContaining({ k: 3 }));
  });

  it('returns an empty candidates list when search yields nothing', async () => {
    vi.doMock('../search', () => ({ searchContent: vi.fn().mockResolvedValue([]), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('findEntryForDocument')!;
    const result = await handler.run({ documentText: 'no match' }, ctx);
    const payload = JSON.parse(asString(result));
    expect(payload.candidates).toEqual([]);
    expect(payload.note).toBeDefined();
  });
});

describe('matchRouteTemplate', () => {
  it('extracts a single placeholder', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]', '/blog/my-post')).toEqual({ slug: 'my-post' });
  });

  it('extracts multiple placeholders', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/items/[id]/[lang]', '/items/42/en')).toEqual({ id: '42', lang: 'en' });
  });

  it('strips scheme + host + query string', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]', 'https://example.com/blog/foo?utm=x')).toEqual({ slug: 'foo' });
  });

  it('handles trailing slashes', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]/', '/blog/foo')).toEqual({ slug: 'foo' });
  });

  it('returns null when the segment count differs', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]', '/blog/foo/extra')).toBeNull();
  });

  it('returns null when literal segments differ', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]', '/news/foo')).toBeNull();
  });

  it('decodes percent-encoded values', async () => {
    const { matchRouteTemplate } = await import('./index');
    expect(matchRouteTemplate('/blog/[slug]', '/blog/hello%20world')).toEqual({ slug: 'hello world' });
  });
});

describe('listCollections tool', () => {
  it('returns the schema overview', async () => {
    vi.doMock('../search', () => ({ searchContent: vi.fn(), clearSearchCache: vi.fn() }));
    const { getToolHandler } = await import('./index');
    const handler = getToolHandler('listCollections')!;
    const result = await handler.run({}, ctx);
    const payload = JSON.parse(asString(result));
    expect(payload.collections).toHaveLength(1);
    expect(payload.collections[0]).toMatchObject({
      name: 'post',
      label: 'Posts',
      hasMany: true,
    });
    expect(payload.collections[0].fields[0]).toMatchObject({
      key: 'title',
      format: 'string',
      required: true,
    });
  });
});
