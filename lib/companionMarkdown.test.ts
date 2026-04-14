import { describe, expect, it } from 'vitest';

import { companionMarkdownPath, companionMarkdownPathsForEntry, getMarkdownFieldNames } from './companionMarkdown';

// Minimal mock collections for the tests
const mockCollections = {
  post: {
    fields: {
      title: { format: 'string' },
      body: { format: 'markdown' },
    },
  },
  homePage: {
    fields: {
      body: { format: 'markdown' },
      footer: { format: 'markdown' },
    },
  },
  role: {
    fields: {
      title: { format: 'string' },
    },
  },
} as any;

describe('companionMarkdownPath', () => {
  it('replaces .json with .{field}.md', () => {
    expect(companionMarkdownPath('cms/content/post/post-123.json', 'body')).toBe('cms/content/post/post-123.body.md');
  });

  it('handles multiple markdown fields on the same entry', () => {
    const base = 'cms/content/homePage/homePage-0000.json';
    expect(companionMarkdownPath(base, 'body')).toBe('cms/content/homePage/homePage-0000.body.md');
    expect(companionMarkdownPath(base, 'footer')).toBe('cms/content/homePage/homePage-0000.footer.md');
  });
});

describe('getMarkdownFieldNames', () => {
  it('returns markdown field names for a collection with markdown fields', () => {
    const names = getMarkdownFieldNames('post', mockCollections);
    expect(names).toEqual(['body']);
  });

  it('returns multiple markdown fields when present', () => {
    const names = getMarkdownFieldNames('homePage', mockCollections);
    expect(names).toEqual(['body', 'footer']);
  });

  it('returns empty array for a collection with no markdown fields', () => {
    const names = getMarkdownFieldNames('role', mockCollections);
    expect(names).toEqual([]);
  });

  it('returns empty array for unknown collection', () => {
    const names = getMarkdownFieldNames('nonexistent', mockCollections);
    expect(names).toEqual([]);
  });
});

describe('companionMarkdownPathsForEntry', () => {
  it('returns a map of field name to companion path', () => {
    const paths = companionMarkdownPathsForEntry(
      'cms/content/homePage/homePage-0000.json',
      'homePage',
      mockCollections,
    );
    expect(paths).toEqual({
      body: 'cms/content/homePage/homePage-0000.body.md',
      footer: 'cms/content/homePage/homePage-0000.footer.md',
    });
  });

  it('returns empty object for collection with no markdown fields', () => {
    const paths = companionMarkdownPathsForEntry('cms/content/role/role-abc.json', 'role', mockCollections);
    expect(paths).toEqual({});
  });
});
