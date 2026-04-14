import { describe, expect, it } from 'vitest';

import { toContentPath, toGeneratedJsonName, toReferenceKey } from './referenceKeys';

describe('referenceKeys', () => {
  describe('toReferenceKey', () => {
    it('converts content path to normalized reference key', () => {
      expect(toReferenceKey('cms/content/post/post-123.json')).toBe('post-123.json');
    });

    it('avoids double prefix: list item id is already post-123-style stem, not bare id', () => {
      expect(toReferenceKey('post-post-123')).toBe('post-post-123.json');
      expect(toReferenceKey('cms/content/post/post-123.json')).toBe('post-123.json');
    });

    it('normalizes key without extension by adding .json', () => {
      expect(toReferenceKey('post-123')).toBe('post-123.json');
    });

    it('keeps already normalized keys unchanged', () => {
      expect(toReferenceKey('author-a1.json')).toBe('author-a1.json');
    });

    it('returns unknown formats unchanged', () => {
      expect(toReferenceKey('not-a-reference-value')).toBe('not-a-reference-value.json');
    });
  });

  describe('toContentPath', () => {
    it('converts normalized key to content path', () => {
      expect(toContentPath('post-123.json')).toBe('cms/content/post/post-123.json');
    });

    it('converts key without extension to content path', () => {
      expect(toContentPath('post-123')).toBe('cms/content/post/post-123.json');
    });

    it('returns empty string for invalid values', () => {
      expect(toContentPath('')).toBe('');
      expect(toContentPath('cms/content/post')).toBe('');
      expect(toContentPath('cms/content/post/123.json')).toBe('');
    });
  });

  describe('toGeneratedJsonName', () => {
    it('converts content path to generated json filename', () => {
      expect(toGeneratedJsonName('cms/content/blog/blog-2a7715c6-a4e6-44e4-aaed-3eae9e497efe.json')).toBe(
        'blog-2a7715c6-a4e6-44e4-aaed-3eae9e497efe.json',
      );
    });

    it('returns empty string for invalid content path', () => {
      expect(toGeneratedJsonName('blog-123.json')).toBe('');
      expect(toGeneratedJsonName('cms/content/blog/123')).toBe('');
    });
  });
});
