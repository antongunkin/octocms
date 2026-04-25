import { describe, expect, it } from 'vitest';

import { describeInvalidKey, isValidContentTypeKey, slugifyKey } from './contentTypeKey';

describe('slugifyKey', () => {
  it('camel-cases multi-word labels', () => {
    expect(slugifyKey('Blog Post')).toBe('blogPost');
    expect(slugifyKey('Product Category')).toBe('productCategory');
    expect(slugifyKey('Home Page')).toBe('homePage');
  });

  it('lower-cases single words', () => {
    expect(slugifyKey('Recipe')).toBe('recipe');
    expect(slugifyKey('AUTHOR')).toBe('author');
  });

  it('strips punctuation but keeps separators', () => {
    expect(slugifyKey('Blog: Posts!')).toBe('blogPosts');
    expect(slugifyKey('Foo / Bar / Baz')).toBe('fooBarBaz');
  });

  it('prefixes leading digits with underscore so the result is a valid identifier', () => {
    expect(slugifyKey('2025 Releases')).toBe('_2025Releases');
    // Even after stripping punctuation, the result must not start with a digit.
    expect(isValidContentTypeKey(slugifyKey('123!!!'))).toBe(true);
  });

  it('returns the empty string for unusable input', () => {
    expect(slugifyKey('')).toBe('');
    expect(slugifyKey('   ')).toBe('');
    expect(slugifyKey('!!!')).toBe('');
  });

  it('produces a valid identifier for any non-empty alphanumeric label', () => {
    const samples = ['Blog Post', 'Recipe', '2025 Releases', 'Product Category', 'Foo_Bar', 'home page'];
    for (const s of samples) {
      const key = slugifyKey(s);
      expect(key).not.toBe('');
      expect(isValidContentTypeKey(key)).toBe(true);
    }
  });
});

describe('describeInvalidKey', () => {
  it('returns null for valid identifiers', () => {
    expect(describeInvalidKey('post')).toBeNull();
    expect(describeInvalidKey('blogPost')).toBeNull();
    expect(describeInvalidKey('_private')).toBeNull();
    expect(describeInvalidKey('$ref')).toBeNull();
  });

  it('flags empty input', () => {
    expect(describeInvalidKey('')).toMatch(/required/);
  });

  it('flags leading digits', () => {
    expect(describeInvalidKey('1post')).toMatch(/letter, \$ or _/);
  });

  it('flags hyphens, dots, and other invalid characters', () => {
    expect(describeInvalidKey('blog-post')).toMatch(/letters, digits/);
    expect(describeInvalidKey('blog.post')).toMatch(/letters, digits/);
    expect(describeInvalidKey('blog post')).toMatch(/letters, digits/);
  });
});
