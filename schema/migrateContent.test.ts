import { describe, expect, it } from 'vitest';

import type { Config } from '../types';
import type { SchemaChange } from './diffSchema';
import { migrateEntry, migrateReferences, type ContentEntry } from './migrateContent';

function entry(overrides: Partial<ContentEntry> = {}): ContentEntry {
  return {
    sys: { id: 'p1', type: 'post', status: 'merged' },
    fields: {},
    path: 'cms/content/post/post-p1.json',
    ...overrides,
  };
}

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

describe('migrateEntry', () => {
  it('returns the entry unchanged when no changes touch its collection', () => {
    const result = migrateEntry(entry({ fields: { title: 'Hi' } }), [
      { kind: 'collection-added', collection: 'author' },
    ]);
    expect(result.entry?.fields).toEqual({ title: 'Hi' });
    expect(result.fileOps).toEqual([]);
    expect(result.companionOps).toEqual([]);
  });

  it('deletes an entry when its collection is removed', () => {
    const changes: SchemaChange[] = [{ kind: 'collection-removed', collection: 'post' }];
    const result = migrateEntry(entry(), changes);
    expect(result.entry).toBeNull();
    expect(result.fileOps).toEqual([{ kind: 'delete', path: 'cms/content/post/post-p1.json' }]);
  });

  it('renames the entry file when the collection is renamed and moves companion .md files', () => {
    const prevConfig = configOf({
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', entryTitle: true },
          body: { label: 'Body', format: 'markdown' },
        },
      },
    });
    const changes: SchemaChange[] = [{ kind: 'collection-renamed', from: 'post', to: 'article' }];
    const result = migrateEntry(entry({ fields: { title: 'Hi' } }), changes, { prevConfig });
    expect(result.entry?.sys.type).toBe('article');
    expect(result.fileOps).toEqual([
      { kind: 'rename', from: 'cms/content/post/post-p1.json', to: 'cms/content/article/article-p1.json' },
    ]);
    expect(result.companionOps).toEqual([
      {
        kind: 'rename',
        from: 'cms/content/post/post-p1.body.md',
        to: 'cms/content/article/article-p1.body.md',
      },
    ]);
  });

  it('drops a removed field and queues companion deletion when the field was markdown', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-removed', collection: 'post', field: 'body', format: 'markdown' },
      { kind: 'field-removed', collection: 'post', field: 'tagline', format: 'string' },
    ];
    const result = migrateEntry(entry({ fields: { title: 'Hi', body: 'merged inline', tagline: 'x' } }), changes);
    expect(result.entry?.fields).toEqual({ title: 'Hi' });
    expect(result.companionOps).toEqual([{ kind: 'delete', path: 'cms/content/post/post-p1.body.md' }]);
  });

  it('renames a field key inside fields', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-renamed', collection: 'post', from: 'published', to: 'isPublished' },
    ];
    const result = migrateEntry(entry({ fields: { published: 'true' } }), changes);
    expect(result.entry?.fields).toEqual({ isPublished: 'true' });
  });

  it('coerces text-like format changes', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-format-changed', collection: 'post', field: 'tagline', from: 'string', to: 'text' },
    ];
    const result = migrateEntry(entry({ fields: { tagline: 'Hello' } }), changes);
    expect(result.entry?.fields).toEqual({ tagline: 'Hello' });
    expect(result.warnings).toEqual([]);
  });

  it('coerces string→number when the value is numeric', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-format-changed', collection: 'post', field: 'count', from: 'string', to: 'number' },
    ];
    const result = migrateEntry(entry({ fields: { count: '42' } }), changes);
    expect(result.entry?.fields).toEqual({ count: 42 });
  });

  it('drops + warns when a value cannot be coerced into the new format', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-format-changed', collection: 'post', field: 'count', from: 'string', to: 'number' },
    ];
    const result = migrateEntry(entry({ fields: { count: 'not a number' } }), changes);
    expect(result.entry?.fields).toEqual({});
    expect(result.warnings.length).toBe(1);
    expect(result.warnings[0]).toMatch(/could not be coerced/);
  });

  it('handles markdown→richtext as a companion-file rename', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-format-changed', collection: 'post', field: 'body', from: 'markdown', to: 'richtext' },
    ];
    const result = migrateEntry(entry(), changes);
    expect(result.companionOps).toEqual([
      {
        kind: 'rename',
        from: 'cms/content/post/post-p1.body.md',
        to: 'cms/content/post/post-p1.body.mdx',
      },
    ]);
  });

  it('warns when an inline value would need promoting to a companion file', () => {
    const changes: SchemaChange[] = [
      { kind: 'field-format-changed', collection: 'post', field: 'body', from: 'string', to: 'markdown' },
    ];
    const result = migrateEntry(entry({ fields: { body: 'inline content' } }), changes);
    expect(result.entry?.fields).toEqual({});
    expect(result.warnings[0]).toMatch(/should be promoted/);
  });
});

// ---------------------------------------------------------------------------
// Phase 6 — cross-collection reference migration
// ---------------------------------------------------------------------------

describe('migrateReferences', () => {
  const cfgWithRefs = (): Config =>
    configOf({
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', entryTitle: true },
          authors: { label: 'Authors', format: 'reference', reference: { collections: ['author'] } },
          editor: { label: 'Editor', format: 'reference', reference: { collections: ['author'], cardinality: 'one' } },
          tags: { label: 'Tags', format: 'string' },
        },
      },
      author: {
        label: 'Author',
        hasMany: true,
        fields: { name: { label: 'Name', format: 'string', entryTitle: true } },
      },
    });

  it('returns the entry unchanged when no rename or remove targets a referenced collection', () => {
    const e = entry({ fields: { authors: JSON.stringify(['author-a1.json']) } });
    const result = migrateReferences(e, [{ kind: 'collection-added', collection: 'tag' }], cfgWithRefs());
    expect(result.changed).toBe(false);
    expect(result.entry).toBe(e);
  });

  it('rewrites JSON-array reference values when their target collection is renamed', () => {
    const e = entry({
      fields: {
        authors: JSON.stringify(['author-a1.json', 'author-a2.json']),
        editor: 'author-a1.json',
        tags: 'unrelated',
      },
    });
    const changes: SchemaChange[] = [{ kind: 'collection-renamed', from: 'author', to: 'writer' }];
    const result = migrateReferences(e, changes, cfgWithRefs());
    expect(result.changed).toBe(true);
    expect(result.rewritten).toBe(3);
    expect(result.pruned).toBe(0);
    expect(result.entry.fields.authors).toBe(JSON.stringify(['writer-a1.json', 'writer-a2.json']));
    expect(result.entry.fields.editor).toBe('writer-a1.json');
    expect(result.entry.fields.tags).toBe('unrelated');
  });

  it('prunes orphaned reference keys when a target collection is removed', () => {
    const e = entry({
      fields: {
        authors: JSON.stringify(['author-a1.json', 'author-a2.json']),
        editor: 'author-a1.json',
      },
    });
    const changes: SchemaChange[] = [{ kind: 'collection-removed', collection: 'author' }];
    const result = migrateReferences(e, changes, cfgWithRefs());
    expect(result.changed).toBe(true);
    expect(result.pruned).toBe(3);
    expect(result.entry.fields.authors).toBe('[]');
    expect(result.entry.fields.editor).toBeNull();
  });

  it('handles native-array reference values (legacy callers)', () => {
    const e = entry({ fields: { authors: ['author-a1.json', 'author-a2.json'] } });
    const changes: SchemaChange[] = [{ kind: 'collection-renamed', from: 'author', to: 'writer' }];
    const result = migrateReferences(e, changes, cfgWithRefs());
    expect(result.entry.fields.authors).toEqual(['writer-a1.json', 'writer-a2.json']);
  });

  it('uses the prev collection key when the entry was itself renamed', () => {
    // Entry is in `post`, but post was just renamed to `article` so sys.type is `article`.
    const e: ContentEntry = {
      sys: { id: 'p1', type: 'article' },
      fields: { authors: JSON.stringify(['author-a1.json']) },
      path: 'cms/content/article/article-p1.json',
    };
    const changes: SchemaChange[] = [
      { kind: 'collection-renamed', from: 'post', to: 'article' },
      { kind: 'collection-renamed', from: 'author', to: 'writer' },
    ];
    const result = migrateReferences(e, changes, cfgWithRefs());
    expect(result.entry.fields.authors).toBe(JSON.stringify(['writer-a1.json']));
  });

  it('skips entries whose prev collection has no reference fields', () => {
    const e: ContentEntry = {
      sys: { id: 'a1', type: 'author' },
      fields: { name: 'Alice' },
      path: 'cms/content/author/author-a1.json',
    };
    const changes: SchemaChange[] = [{ kind: 'collection-removed', collection: 'tag' }];
    const result = migrateReferences(e, changes, cfgWithRefs());
    expect(result.changed).toBe(false);
  });

  it('leaves reference values pointing at unaffected collections alone', () => {
    const e = entry({
      fields: { authors: JSON.stringify(['author-a1.json', 'tag-t1.json']) },
    });
    const changes: SchemaChange[] = [{ kind: 'collection-removed', collection: 'tag' }];
    const result = migrateReferences(e, changes, cfgWithRefs());
    // tag-t1.json is dropped; author-a1.json survives.
    expect(result.entry.fields.authors).toBe(JSON.stringify(['author-a1.json']));
    expect(result.pruned).toBe(1);
  });
});
