import { revalidatePath, updateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildJsons } from './build';

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
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

  it('returns failure when updateTag throws', async () => {
    vi.mocked(updateTag).mockImplementationOnce(() => {
      throw new Error('tag error');
    });

    const result = await buildJsons();
    expect(result).toEqual({ success: false, error: 'tag error' });
  });
});
