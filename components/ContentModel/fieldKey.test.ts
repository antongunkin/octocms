import { describe, expect, it } from 'vitest';

import { describeInvalidFieldKey, isValidFieldKey, slugifyFieldKey } from './fieldKey';

describe('slugifyFieldKey', () => {
  it('camel-cases multi-word labels', () => {
    expect(slugifyFieldKey('Cover Image')).toBe('coverImage');
    expect(slugifyFieldKey('Published At')).toBe('publishedAt');
    expect(slugifyFieldKey('First Name')).toBe('firstName');
  });

  it('lower-cases single words', () => {
    expect(slugifyFieldKey('Title')).toBe('title');
    expect(slugifyFieldKey('AUTHOR')).toBe('author');
  });

  it('strips punctuation but keeps separators', () => {
    expect(slugifyFieldKey('Author / Bio!')).toBe('authorBio');
    expect(slugifyFieldKey('Foo: bar (baz)')).toBe('fooBarBaz');
  });

  it('prefixes leading digits with underscore so the result is a valid identifier', () => {
    expect(slugifyFieldKey('2025 Edition')).toBe('_2025Edition');
    expect(isValidFieldKey(slugifyFieldKey('123 abc'))).toBe(true);
  });

  it('returns the empty string for unusable input', () => {
    expect(slugifyFieldKey('')).toBe('');
    expect(slugifyFieldKey('   ')).toBe('');
    expect(slugifyFieldKey('!!!')).toBe('');
  });
});

describe('describeInvalidFieldKey', () => {
  it('returns null for valid identifiers', () => {
    expect(describeInvalidFieldKey('title')).toBeNull();
    expect(describeInvalidFieldKey('publishedAt')).toBeNull();
    expect(describeInvalidFieldKey('_private')).toBeNull();
    expect(describeInvalidFieldKey('$ref')).toBeNull();
  });

  it('flags empty input', () => {
    expect(describeInvalidFieldKey('')).toMatch(/required/);
  });

  it('flags leading digits', () => {
    expect(describeInvalidFieldKey('1published')).toMatch(/letter, \$ or _/);
  });

  it('flags invalid characters', () => {
    expect(describeInvalidFieldKey('cover-image')).toMatch(/letters, digits/);
    expect(describeInvalidFieldKey('cover.image')).toMatch(/letters, digits/);
    expect(describeInvalidFieldKey('cover image')).toMatch(/letters, digits/);
  });
});
