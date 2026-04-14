import { describe, expect, it } from 'vitest';
import {
  CODEGEN_BANNER,
  fieldToTSType,
  generateContentDecls,
  generateEnums,
  generateIndex,
  generateTypes,
  pascalCase,
} from './codegen';
import type { CollectionField, Config } from '../../types';

describe('pascalCase', () => {
  it('capitalizes first letter', () => {
    expect(pascalCase('post')).toBe('Post');
  });

  it('preserves existing capitals', () => {
    expect(pascalCase('homePage')).toBe('HomePage');
  });

  it('handles single char', () => {
    expect(pascalCase('a')).toBe('A');
  });
});

describe('fieldToTSType', () => {
  const collections = ['post', 'author'] as const;

  it('string → string', () => {
    const f: CollectionField = { label: 'Title', format: 'string' };
    expect(fieldToTSType(f, collections)).toBe('string');
  });

  it('string list → string[]', () => {
    const f: CollectionField = { label: 'Tags', format: 'string', list: true };
    expect(fieldToTSType(f, collections)).toBe('string[]');
  });

  it('boolean → union', () => {
    const f: CollectionField = { label: 'Active', format: 'boolean' };
    expect(fieldToTSType(f, collections)).toBe("'true' | 'false'");
  });

  it('number → number | null', () => {
    const f: CollectionField = { label: 'Count', format: 'number' };
    expect(fieldToTSType(f, collections)).toBe('number | null');
  });

  it('datetime → string | null', () => {
    const f: CollectionField = { label: 'Date', format: 'datetime' };
    expect(fieldToTSType(f, collections)).toBe('string | null');
  });

  it('image resolved → ResolvedImageField', () => {
    const f: CollectionField = { label: 'Image', format: 'image' };
    expect(fieldToTSType(f, collections, 'resolved')).toBe('ResolvedImageField');
  });

  it('image raw → string', () => {
    const f: CollectionField = { label: 'Image', format: 'image' };
    expect(fieldToTSType(f, collections, 'raw')).toBe('string');
  });

  it('select → union of option values', () => {
    const f: CollectionField = {
      label: 'Status',
      format: 'select',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Live', value: 'live' },
      ],
    };
    expect(fieldToTSType(f, collections)).toBe("'draft' | 'live'");
  });

  it('select multiple → union array', () => {
    const f: CollectionField = {
      label: 'Tags',
      format: 'select',
      multiple: true,
      options: [
        { label: 'A', value: 'a' },
        { label: 'B', value: 'b' },
      ],
    };
    expect(fieldToTSType(f, collections)).toBe("('a' | 'b')[]");
  });

  it('reference many → entry array', () => {
    const f: CollectionField = {
      label: 'Authors',
      format: 'reference',
      reference: { collections: ['author'], cardinality: 'many' },
    };
    expect(fieldToTSType(f, collections)).toBe('AuthorEntry[]');
  });

  it('reference one → entry | null', () => {
    const f: CollectionField = {
      label: 'Author',
      format: 'reference',
      reference: { collections: ['author'], cardinality: 'one' },
    };
    expect(fieldToTSType(f, collections)).toBe('AuthorEntry | null');
  });

  it('reference many with multiple collections → union array', () => {
    const f: CollectionField = {
      label: 'Refs',
      format: 'reference',
      reference: { collections: ['post', 'author'], cardinality: 'many' },
    };
    expect(fieldToTSType(f, collections)).toBe('(PostEntry | AuthorEntry)[]');
  });

  it('text/markdown/slug/url/color → string', () => {
    for (const format of ['text', 'markdown', 'slug', 'url', 'color'] as const) {
      const f = { label: 'X', format } as CollectionField;
      expect(fieldToTSType(f, collections)).toBe('string');
    }
  });

  it('richtext → RichTextDocument', () => {
    const f: CollectionField = { label: 'Body', format: 'richtext' };
    expect(fieldToTSType(f, collections)).toBe('RichTextDocument');
  });

  it('json → unknown', () => {
    const f: CollectionField = { label: 'Data', format: 'json' };
    expect(fieldToTSType(f, collections)).toBe('unknown');
  });
});

describe('generateTypes', () => {
  const cfg: Config = {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string' },
          count: { label: 'Count', format: 'number' },
        },
      },
    },
  };
  const collections = ['post'];

  it('generates Fields interface', () => {
    const out = generateTypes(cfg, collections);
    expect(out).toContain('export interface PostFields {');
    expect(out).toContain('  title: string;');
    expect(out).toContain('  count: number | null;');
  });

  it('generates Entry interface', () => {
    const out = generateTypes(cfg, collections);
    expect(out).toContain('export interface PostEntry {');
    expect(out).toContain("  sys: { id: string; type: 'post'; status: EntryStatus };");
    expect(out).toContain('  fields: PostFields;');
  });

  it('generates AnyEntry type', () => {
    const out = generateTypes(cfg, collections);
    expect(out).toContain('export type AnyEntry = PostEntry;');
  });

  it('generates EntryMap', () => {
    const out = generateTypes(cfg, collections);
    expect(out).toContain('export type EntryMap = {');
    expect(out).toContain('  post: PostEntry;');
  });

  it('includes banner', () => {
    const out = generateTypes(cfg, collections);
    expect(out).toContain('AUTO-GENERATED');
  });
});

describe('generateEnums', () => {
  const cfg: Config = {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        fields: {
          status: {
            label: 'Status',
            format: 'select',
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Live', value: 'live' },
            ],
          },
        },
      },
    },
  };
  const collections = ['post'];
  const fieldTypes = ['string', 'number'];

  it('generates CollectionName const', () => {
    const out = generateEnums(cfg, collections, fieldTypes);
    expect(out).toContain("Post: 'post',");
  });

  it('generates COLLECTION_NAMES array', () => {
    const out = generateEnums(cfg, collections, fieldTypes);
    expect(out).toContain("export const COLLECTION_NAMES = ['post'] as const;");
  });

  it('generates select option enums', () => {
    const out = generateEnums(cfg, collections, fieldTypes);
    expect(out).toContain('export const PostStatusOption = {');
    expect(out).toContain("  Draft: 'draft',");
    expect(out).toContain("  Live: 'live',");
  });

  it('generates FieldFormat const', () => {
    const out = generateEnums(cfg, collections, fieldTypes);
    expect(out).toContain('export const FieldFormat = {');
    expect(out).toContain("  String: 'string',");
  });
});

describe('generateContentDecls', () => {
  const cfg: Config = {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        fields: {
          title: { label: 'Title', format: 'string' },
          body: { label: 'Body', format: 'markdown' },
          content: { label: 'Content', format: 'richtext' },
          image: { label: 'Image', format: 'image' },
        },
      },
    },
  };

  it('omits markdown and richtext fields', () => {
    const out = generateContentDecls(cfg, ['post']);
    expect(out).toContain('  title: string;');
    expect(out).not.toContain('body:');
    expect(out).not.toContain('content:');
  });

  it('uses raw type for image fields', () => {
    const out = generateContentDecls(cfg, ['post']);
    expect(out).toContain('  image: string;');
  });

  it('generates RawEntryMap', () => {
    const out = generateContentDecls(cfg, ['post']);
    expect(out).toContain('export type RawEntryMap = {');
    expect(out).toContain('  post: RawPostEntry;');
  });
});

describe('generateIndex', () => {
  it('re-exports types and enums', () => {
    const out = generateIndex();
    expect(out).toContain(CODEGEN_BANNER);
    expect(out).toContain("export * from './types';");
    expect(out).toContain("export * from './enums';");
  });
});
