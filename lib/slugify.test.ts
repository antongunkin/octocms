import { describe, expect, it } from 'vitest';

import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases ASCII input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('converts spaces to hyphens', () => {
    expect(slugify('foo bar baz')).toBe('foo-bar-baz');
  });

  it('converts underscores to hyphens', () => {
    expect(slugify('foo_bar_baz')).toBe('foo-bar-baz');
  });

  it('strips accented characters to ASCII base', () => {
    expect(slugify('café')).toBe('cafe');
    expect(slugify('über')).toBe('uber');
    expect(slugify('naïve')).toBe('naive');
    expect(slugify('résumé')).toBe('resume');
    expect(slugify('jalapeño')).toBe('jalapeno');
  });

  it('removes special characters', () => {
    expect(slugify('foo & bar!')).toBe('foo-bar');
    expect(slugify('hello.world')).toBe('helloworld');
    expect(slugify('price: $9.99')).toBe('price-999');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('foo  --  bar')).toBe('foo-bar');
    expect(slugify('a---b')).toBe('a-b');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  hello  ')).toBe('hello');
    expect(slugify('---hello---')).toBe('hello');
  });

  it('handles numbers', () => {
    expect(slugify('100 things')).toBe('100-things');
    expect(slugify('post 2024-01-01')).toBe('post-2024-01-01');
  });

  it('returns empty string for blank input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
    expect(slugify('---')).toBe('');
    expect(slugify('!!!???')).toBe('');
  });

  it('passes through an already-valid slug unchanged', () => {
    expect(slugify('my-slug')).toBe('my-slug');
    expect(slugify('hello-world-123')).toBe('hello-world-123');
  });

  it('handles mixed-case with special chars', () => {
    expect(slugify('Getting Started with Next.js')).toBe('getting-started-with-nextjs');
  });

  it('handles unicode ligatures and other NFKD forms', () => {
    expect(slugify('ﬁle')).toBe('file'); // fi ligature
  });
});
