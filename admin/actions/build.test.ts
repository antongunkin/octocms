import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildJsons } from './build';

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock('../github', () => ({
  isProductionMode: vi.fn(() => false),
  saveGitHubFile: vi.fn(),
}));

vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn(),
  },
}));

vi.mock('glob', () => ({
  glob: vi.fn(),
}));

const mockConfig = {
  contentFolder: 'cms/content',
  search: {
    publicCollections: {
      post: { urlPattern: '/blog/:slug' },
    },
  },
  collections: {
    post: {
      label: 'Post',
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        slug: { label: 'Slug', format: 'slug' },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

vi.mock('octocms/lib/companionMarkdown', () => ({
  companionMarkdownPathsForEntry: vi.fn(() => ({})),
  companionRichTextPathsForEntry: vi.fn(() => ({})),
}));

vi.mock('octocms/lib/searchIndex', () => ({
  buildSearchIndex: vi.fn(() => '{}'),
}));

// ─── buildJsons ───────────────────────────────────────────────────────────────

describe('buildJsons', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns success', async () => {
    const result = await buildJsons();
    expect(result).toEqual({ success: true });
  });

  it('calls updateTag for homePage and blog cache keys', async () => {
    await buildJsons();

    expect(updateTag).toHaveBeenCalledWith('homePage');
    expect(updateTag).toHaveBeenCalledWith('blog');
    expect(vi.mocked(updateTag).mock.calls.length).toBe(2);
  });

  it('revalidates the standard public page paths', async () => {
    await buildJsons();

    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
    expect(revalidatePath).toHaveBeenCalledWith('/blog', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/[slug]', 'page');
  });

  it('revalidates slug paths when blogPaths provided', async () => {
    await buildJsons(undefined, {
      blogPaths: ['/blog/my-post', '/blog/old-slug'],
    });

    expect(revalidatePath).toHaveBeenCalledWith('/blog/my-post');
    expect(revalidatePath).toHaveBeenCalledWith('/blog/old-slug');
  });

  it('dedupes blogPaths', async () => {
    await buildJsons(undefined, { blogPaths: ['/blog/x', '/blog/x'] });

    const blogCalls = vi.mocked(revalidatePath).mock.calls.filter(([p]) => p === '/blog/x');
    expect(blogCalls.length).toBe(1);
  });

  it('does not call extra revalidatePath for blogPaths when undefined', async () => {
    await buildJsons();

    const calls = vi.mocked(revalidatePath).mock.calls.map(([p]) => p);
    expect(calls.filter((p) => p.startsWith('/blog/') && p !== '/blog' && p !== '/blog/[slug]')).toEqual([]);
  });

  it('falls back to revalidateTag when updateTag throws (Route Handler context)', async () => {
    // updateTag throws outside Server Actions; the proposal accept Route Handler
    // hits this path. buildJsons must keep the cache invalidation working via
    // revalidateTag instead of bubbling the error up.
    vi.mocked(updateTag).mockImplementation(() => {
      throw new Error('updateTag can only be called from within a Server Action');
    });

    const result = await buildJsons();
    expect(result).toEqual({ success: true });

    // Both public cache tags must have been invalidated via the fallback.
    expect(vi.mocked(revalidateTag).mock.calls.map(([t]) => t)).toEqual(['homePage', 'blog']);
    for (const call of vi.mocked(revalidateTag).mock.calls) {
      expect(call[1]).toEqual({ expire: 0 });
    }
  });
});
