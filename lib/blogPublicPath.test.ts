import { describe, expect, it } from 'vitest';

import { getPostBlogPublicPath, postSlugMatchesUrlParam } from './blogPublicPath';

describe('getPostBlogPublicPath', () => {
  it('returns null for non-post', () => {
    expect(getPostBlogPublicPath({ sys: { type: 'item' }, fields: { slug: 'x' } })).toBeNull();
  });

  it('returns path for post with slug', () => {
    expect(getPostBlogPublicPath({ sys: { type: 'post' }, fields: { slug: 'my-post' } })).toBe('/blog/my-post');
  });

  it('returns null when slug missing', () => {
    expect(getPostBlogPublicPath({ sys: { type: 'post' }, fields: {} })).toBeNull();
  });
});

describe('postSlugMatchesUrlParam', () => {
  it('matches normalized slugs', () => {
    expect(postSlugMatchesUrlParam('My-Post', 'my-post')).toBe(true);
  });

  it('rejects mismatch', () => {
    expect(postSlugMatchesUrlParam('a', 'b')).toBe(false);
  });
});
