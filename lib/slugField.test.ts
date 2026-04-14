import { describe, expect, it } from 'vitest';

import {
  isValidSlugPattern,
  parseSlugFieldInput,
  sanitizeSlugFieldInputValue,
  slugifyForUrl,
  SLUG_MAX_LENGTH,
} from './slugField';

describe('sanitizeSlugFieldInputValue', () => {
  it('maps spaces and underscores to hyphens', () => {
    expect(sanitizeSlugFieldInputValue('post-2_ sdd')).toBe('post-2-sdd');
  });

  it('strips characters that are not allowed in URL slugs', () => {
    expect(sanitizeSlugFieldInputValue('a!@#b')).toBe('ab');
  });

  it('preserves a trailing hyphen while typing', () => {
    expect(sanitizeSlugFieldInputValue('my-')).toBe('my-');
  });

  it('lowercases', () => {
    expect(sanitizeSlugFieldInputValue('Hello')).toBe('hello');
  });
});

describe('slugifyForUrl', () => {
  it('lowercases and hyphenates words', () => {
    expect(slugifyForUrl('Hello World')).toBe('hello-world');
  });

  it('strips unsafe characters', () => {
    expect(slugifyForUrl('Café & More!!!')).toBe('cafe-and-more');
  });

  it('collapses multiple hyphens', () => {
    expect(slugifyForUrl('a---b')).toBe('a-b');
  });

  it('returns empty for whitespace-only input', () => {
    expect(slugifyForUrl('   ')).toBe('');
  });

  it('treats underscores like spaces between words', () => {
    expect(slugifyForUrl('post_2')).toBe('post-2');
  });
});

describe('isValidSlugPattern', () => {
  it('accepts simple slugs', () => {
    expect(isValidSlugPattern('post-1')).toBe(true);
  });

  it('rejects leading or trailing hyphens after normalize', () => {
    expect(isValidSlugPattern('-bad')).toBe(false);
    expect(isValidSlugPattern('bad-')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidSlugPattern('')).toBe(false);
  });

  it('respects max length', () => {
    const long = 'a'.repeat(SLUG_MAX_LENGTH + 1);
    expect(isValidSlugPattern(long)).toBe(false);
  });
});

describe('parseSlugFieldInput', () => {
  const label = 'URL slug';

  it('requires non-empty when required', () => {
    const r = parseSlugFieldInput({ label, required: true }, '  ');
    expect(r.ok).toBe(false);
  });

  it('allows empty when optional', () => {
    const r = parseSlugFieldInput({ label, required: false }, '  ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('');
  });

  it('normalizes valid input', () => {
    const r = parseSlugFieldInput({ label, required: true }, ' My Post Title ');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toBe('my-post-title');
  });
});
