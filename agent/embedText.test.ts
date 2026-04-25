import { describe, expect, it } from 'vitest';

import { entryToEmbeddingText } from './embedText';

describe('entryToEmbeddingText', () => {
  it('returns empty string for an empty entry', () => {
    expect(entryToEmbeddingText({})).toBe('');
    expect(entryToEmbeddingText({ fields: {} })).toBe('');
  });

  it('flattens scalar fields with field-name labels', () => {
    const text = entryToEmbeddingText({
      fields: { title: 'Hello', count: 3, published: true },
    });
    expect(text).toBe('title: Hello\ncount: 3\npublished: true');
  });

  it('skips empty / null / undefined values', () => {
    const text = entryToEmbeddingText({
      fields: { title: 'Hello', subtitle: '', body: null, footer: undefined },
    });
    expect(text).toBe('title: Hello');
  });

  it('joins array values with ", "', () => {
    const text = entryToEmbeddingText({
      fields: { tags: ['a', 'b', 'c'] },
    });
    expect(text).toBe('tags: a, b, c');
  });

  it('flattens object leaf values (e.g. resolved image fields)', () => {
    const text = entryToEmbeddingText({
      fields: {
        cover: { src: '/media/abc.png', alt: 'Sunset', width: 800, height: 600 },
      },
    });
    expect(text).toBe('cover: src: /media/abc.png, alt: Sunset, width: 800, height: 600');
  });

  it('keeps reference field key strings as-is (no resolution)', () => {
    const text = entryToEmbeddingText({
      fields: { authors: ['author-abc.json', 'author-def.json'] },
    });
    expect(text).toBe('authors: author-abc.json, author-def.json');
  });

  it('inlines companion content under the field name', () => {
    const text = entryToEmbeddingText(
      { fields: { title: 'Post' } },
      { body: '# Hello\nworld', footer: 'Goodbye' },
    );
    expect(text).toBe('title: Post\nbody: # Hello\nworld\nfooter: Goodbye');
  });

  it('lets companion content win when a field name appears in both', () => {
    const text = entryToEmbeddingText(
      { fields: { body: 'placeholder string' } },
      { body: 'real markdown content' },
    );
    expect(text).toBe('body: real markdown content');
  });

  it('skips empty companion content', () => {
    const text = entryToEmbeddingText({ fields: { title: 'Post' } }, { body: '   ', footer: '' });
    expect(text).toBe('title: Post');
  });
});
