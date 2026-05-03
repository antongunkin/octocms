import { describe, expect, it } from 'vitest';

import type { Config } from '../types';
import { diffSchema } from './diffSchema';

const baseGit = { baseBranch: 'main' };

function configOf(collections: Config['collections']): Config {
  return {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: baseGit,
    collections,
  };
}

describe('diffSchema', () => {
  it('reports an empty diff when configs are identical', () => {
    const cfg = configOf({
      post: { label: 'Post', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    });
    expect(diffSchema(cfg, cfg)).toEqual([]);
  });

  it('detects collection-added and collection-removed', () => {
    const prev = configOf({
      post: { label: 'Post', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    });
    const next = configOf({
      author: { label: 'Author', hasMany: true, fields: { name: { label: 'Name', format: 'string' } } },
    });
    const changes = diffSchema(prev, next);
    expect(changes).toContainEqual({ kind: 'collection-removed', collection: 'post' });
    expect(changes).toContainEqual({ kind: 'collection-added', collection: 'author' });
  });

  it('detects collection-renamed when given a hint', () => {
    const prev = configOf({
      post: { label: 'Post', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    });
    const next = configOf({
      article: { label: 'Article', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    });
    const changes = diffSchema(prev, next, { collectionRenames: { post: 'article' } });
    expect(changes).toEqual([{ kind: 'collection-renamed', from: 'post', to: 'article' }]);
  });

  it('detects collection-hasMany-changed', () => {
    const prev = configOf({
      page: { label: 'Page', hasMany: false, fields: { title: { label: 'Title', format: 'string' } } },
    });
    const next = configOf({
      page: { label: 'Page', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    });
    expect(diffSchema(prev, next)).toEqual([
      { kind: 'collection-hasMany-changed', collection: 'page', from: false, to: true },
    ]);
  });

  it('detects field-added, field-removed, and field-format-changed', () => {
    const prev = configOf({
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string' },
          legacy: { label: 'Legacy', format: 'string' },
          count: { label: 'Count', format: 'string' },
        },
      },
    });
    const next = configOf({
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string' },
          count: { label: 'Count', format: 'number' },
          published: { label: 'Published', format: 'boolean' },
        },
      },
    });
    const changes = diffSchema(prev, next);
    expect(changes).toContainEqual({ kind: 'field-removed', collection: 'post', field: 'legacy', format: 'string' });
    expect(changes).toContainEqual({ kind: 'field-added', collection: 'post', field: 'published', format: 'boolean' });
    expect(changes).toContainEqual({
      kind: 'field-format-changed',
      collection: 'post',
      field: 'count',
      from: 'string',
      to: 'number',
    });
  });

  it('detects field-renamed when given a hint and surfaces an accompanying format change', () => {
    const prev = configOf({
      post: { label: 'Post', hasMany: true, fields: { published: { label: 'Published', format: 'string' } } },
    });
    const next = configOf({
      post: { label: 'Post', hasMany: true, fields: { isPublished: { label: 'Is published', format: 'boolean' } } },
    });
    const changes = diffSchema(prev, next, {
      fieldRenames: { post: { published: 'isPublished' } },
    });
    expect(changes).toContainEqual({
      kind: 'field-renamed',
      collection: 'post',
      from: 'published',
      to: 'isPublished',
    });
    expect(changes).toContainEqual({
      kind: 'field-format-changed',
      collection: 'post',
      field: 'isPublished',
      from: 'string',
      to: 'boolean',
    });
  });

  it('handles fields under a renamed collection (hint keyed by next-collection-name)', () => {
    const prev = configOf({
      post: {
        label: 'Post',
        hasMany: true,
        fields: { title: { label: 'Title', format: 'string' }, body: { label: 'Body', format: 'markdown' } },
      },
    });
    const next = configOf({
      article: {
        label: 'Article',
        hasMany: true,
        fields: { title: { label: 'Title', format: 'string' }, content: { label: 'Content', format: 'markdown' } },
      },
    });
    const changes = diffSchema(prev, next, {
      collectionRenames: { post: 'article' },
      fieldRenames: { article: { body: 'content' } },
    });
    expect(changes).toContainEqual({ kind: 'collection-renamed', from: 'post', to: 'article' });
    expect(changes).toContainEqual({ kind: 'field-renamed', collection: 'article', from: 'body', to: 'content' });
  });
});
