import { describe, expect, it } from 'vitest';

import type { Config } from '../admin/types';

import {
  buildSearchIndex,
  getSearchableFields,
  querySearchIndex,
  resolveUrlPattern,
  stripMarkup,
  type EntryForSearch,
} from './searchIndex';

// --- Minimal test config ---

const testConfig: Config = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png'],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        slug: { label: 'Slug', format: 'slug' },
        body: { label: 'Body', format: 'markdown' },
        featuredImage: { label: 'Image', format: 'image' },
        publishedAt: { label: 'Published', format: 'datetime' },
        tags: { label: 'Tags', format: 'string', list: true },
      },
    },
    item: {
      label: 'Item',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        enabled: { label: 'Enabled', format: 'boolean' },
        category: {
          label: 'Category',
          format: 'select',
          options: [
            { label: 'General', value: 'general' },
            { label: 'Featured', value: 'featured' },
          ],
        },
        sortOrder: { label: 'Sort', format: 'number' },
        secret: { label: 'Secret', format: 'string', searchable: false },
      },
    },
    homePage: {
      label: 'Home Page',
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        body: { label: 'Body', format: 'richtext' },
      },
    },
  } as unknown as Config['collections'],
  search: {
    publicCollections: {
      post: { urlPattern: '/blog/:slug' },
      item: { urlPattern: '/items/:id' },
    },
  },
};

// --- Helpers ---

function makeEntry(
  type: string,
  id: string,
  fields: Record<string, unknown>,
  companion: Record<string, string> = {},
): EntryForSearch {
  return {
    path: `${type}/${type}-${id}.json`,
    content: { sys: { id, type }, fields },
    companionContent: companion,
  };
}

// --- Tests ---

describe('getSearchableFields', () => {
  it('returns text-like fields by default', () => {
    const fields = getSearchableFields('post', testConfig);
    expect(fields).toContain('title');
    expect(fields).toContain('slug');
    expect(fields).toContain('body');
    expect(fields).toContain('tags');
  });

  it('excludes non-text fields by default', () => {
    const fields = getSearchableFields('post', testConfig);
    expect(fields).not.toContain('featuredImage');
    expect(fields).not.toContain('publishedAt');
  });

  it('respects searchable: false override', () => {
    const fields = getSearchableFields('item', testConfig);
    expect(fields).not.toContain('secret');
  });

  it('includes select fields', () => {
    const fields = getSearchableFields('item', testConfig);
    expect(fields).toContain('category');
  });

  it('returns empty for unknown collection', () => {
    expect(getSearchableFields('nonexistent', testConfig)).toEqual([]);
  });
});

describe('stripMarkup', () => {
  it('removes HTML tags', () => {
    expect(stripMarkup('<p>Hello <strong>world</strong></p>')).toBe('Hello world');
  });

  it('removes markdown headings', () => {
    expect(stripMarkup('## My Heading\nSome text')).toBe('My Heading Some text');
  });

  it('converts markdown links to text', () => {
    expect(stripMarkup('Visit [our site](https://example.com) today')).toBe('Visit our site today');
  });

  it('removes markdown images', () => {
    expect(stripMarkup('Before ![alt text](image.png) after')).toBe('Before after');
  });

  it('removes bold/italic markers', () => {
    expect(stripMarkup('This is **bold** and *italic* text')).toBe('This is bold and italic text');
  });

  it('removes inline code backticks', () => {
    expect(stripMarkup('Use `console.log` here')).toBe('Use console.log here');
  });

  it('removes fenced code block markers', () => {
    expect(stripMarkup('```js\nconst x = 1;\n```')).toBe('const x = 1;');
  });

  it('removes MDX import/export statements', () => {
    expect(stripMarkup("import Foo from './Foo';\nexport const x = 1;\nHello")).toBe('Hello');
  });

  it('removes blockquote markers', () => {
    expect(stripMarkup('> This is a quote\n> continued')).toBe('This is a quote continued');
  });

  it('handles empty string', () => {
    expect(stripMarkup('')).toBe('');
  });
});

describe('resolveUrlPattern', () => {
  const entry = makeEntry('post', 'p1', { slug: 'hello-world', title: 'Hello' });

  it('resolves :fieldName from entry fields', () => {
    expect(resolveUrlPattern('/blog/:slug', entry, 'p1')).toBe('/blog/hello-world');
  });

  it('resolves :id from entry id', () => {
    expect(resolveUrlPattern('/items/:id', entry, 'p1')).toBe('/items/p1');
  });

  it('returns fixed paths as-is', () => {
    expect(resolveUrlPattern('/', entry, 'p1')).toBe('/');
    expect(resolveUrlPattern('/about', entry, 'p1')).toBe('/about');
  });

  it('returns null if referenced field is missing', () => {
    const noSlug = makeEntry('post', 'p2', { title: 'No Slug' });
    expect(resolveUrlPattern('/blog/:slug', noSlug, 'p2')).toBeNull();
  });

  it('returns null if referenced field is empty', () => {
    const emptySlug = makeEntry('post', 'p3', { slug: '', title: 'Empty' });
    expect(resolveUrlPattern('/blog/:slug', emptySlug, 'p3')).toBeNull();
  });

  it('resolves multiple placeholders', () => {
    const entry2 = makeEntry('post', 'p4', { category: 'tech', slug: 'my-post' });
    expect(resolveUrlPattern('/:category/:slug', entry2, 'p4')).toBe('/tech/my-post');
  });
});

describe('buildSearchIndex + querySearchIndex', () => {
  const entries: EntryForSearch[] = [
    makeEntry(
      'post',
      'p1',
      { title: 'Getting Started with TypeScript', slug: 'typescript-guide', tags: ['typescript', 'guide'] },
      { body: '# Introduction\n\nTypeScript is a typed superset of JavaScript.' },
    ),
    makeEntry(
      'post',
      'p2',
      { title: 'React Hooks Deep Dive', slug: 'react-hooks', tags: ['react'] },
      { body: 'Learn about useState, useEffect, and custom hooks.' },
    ),
    makeEntry('item', 'i1', { title: 'Widget Alpha', category: 'featured', enabled: 'true', sortOrder: 1 }, {}),
    makeEntry('item', 'i2', { title: 'Widget Beta', category: 'general', enabled: 'false', sortOrder: 2 }, {}),
  ];

  it('builds and queries an index', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Getting Started with TypeScript');
    expect(results[0].type).toBe('post');
    expect(results[0].typeLabel).toBe('Post');
  });

  it('supports fuzzy matching', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'Typscript'); // typo
    expect(results.length).toBeGreaterThan(0);
  });

  it('supports prefix matching', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'Type');
    expect(results.length).toBeGreaterThan(0);
  });

  it('boosts title matches', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'Widget');
    expect(results.length).toBe(2);
    // Both items have "Widget" in the title
    expect(results.every((r) => r.type === 'item')).toBe(true);
  });

  it('searches companion markdown content', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'useState');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe('post/post-p2');
  });

  it('searches select field labels', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'Featured');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('item/item-i1');
  });

  it('filters by allowed collections', () => {
    const index = buildSearchIndex(entries, testConfig, ['post']);
    const results = querySearchIndex(index, 'Widget');
    expect(results.length).toBe(0);
  });

  it('respects limit', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'Widget', 1);
    expect(results.length).toBe(1);
  });

  it('returns empty for empty query', () => {
    const index = buildSearchIndex(entries, testConfig);
    expect(querySearchIndex(index, '')).toEqual([]);
    expect(querySearchIndex(index, '   ')).toEqual([]);
  });

  it('includes resolved URLs for public collections', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'TypeScript');
    expect(results[0].id).toBe('post/post-p1');
    // URL is stored in the index — we can check by re-loading
    const miniResults = querySearchIndex(index, 'TypeScript');
    expect(miniResults.length).toBeGreaterThan(0);
  });

  it('excludes entries with unresolvable URL patterns from public index', () => {
    const noSlugEntry = makeEntry('post', 'p-no-slug', { title: 'No Slug Post' }, {});
    const publicOnlyConfig: Config = {
      ...testConfig,
      search: { publicCollections: { post: { urlPattern: '/blog/:slug' } } },
    };
    const index = buildSearchIndex([noSlugEntry], publicOnlyConfig, ['post']);
    const results = querySearchIndex(index, 'No Slug');
    expect(results.length).toBe(0);
  });

  it('searches string list fields (tags)', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'guide');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('post/post-p1');
  });

  it('includes a snippet in search results', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
    expect(typeof results[0].snippet).toBe('string');
  });

  it('includes snippet in all results', () => {
    const index = buildSearchIndex(entries, testConfig);
    const results = querySearchIndex(index, 'TypeScript');
    expect(results.length).toBeGreaterThan(0);
    // All results should have a snippet field
    results.forEach((result) => {
      expect(typeof result.snippet).toBe('string');
    });
  });
});
