import { describe, expect, it } from 'vitest';
import { generateContentDecls, generateEnums, generateIndex, generateTypes } from '../lib/codegen';
import type { Config } from '../../types';

/**
 * The typesGen command delegates to codegen functions (tested in codegen.test.ts)
 * and project loader (requires jiti + real config). This file tests the
 * end-to-end codegen output for a realistic multi-collection config.
 */

function makeConfig(): Config {
  return {
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
          title: { label: 'Title', format: 'string', entryTitle: true, required: true },
          slug: { label: 'Slug', format: 'slug', slugSource: 'title' },
          body: { label: 'Body', format: 'markdown' },
          featured: { label: 'Featured', format: 'boolean' },
          publishedAt: { label: 'Published At', format: 'datetime' },
          tags: { label: 'Tags', format: 'string', list: true },
          coverImage: { label: 'Cover Image', format: 'image' },
          authors: {
            label: 'Authors',
            format: 'reference',
            reference: { collections: ['author'], cardinality: 'many' },
          },
        },
      },
      author: {
        label: 'Author',
        fields: {
          name: { label: 'Name', format: 'string', entryTitle: true },
          bio: { label: 'Bio', format: 'text' },
        },
      },
    },
  };
}

describe('typesGen end-to-end output', () => {
  const config = makeConfig();
  const collections = ['post', 'author'];
  const fieldTypes = ['string', 'text', 'markdown', 'boolean', 'reference', 'image', 'number', 'datetime', 'slug'];

  it('generates types for all collections', () => {
    const out = generateTypes(config, collections);
    expect(out).toContain('export interface PostFields {');
    expect(out).toContain('export interface AuthorFields {');
    expect(out).toContain('export interface PostEntry {');
    expect(out).toContain('export interface AuthorEntry {');
    expect(out).toContain('export type AnyEntry = PostEntry | AuthorEntry;');
  });

  it('generates correct field types for post', () => {
    const out = generateTypes(config, collections);
    expect(out).toContain('  title: string;');
    expect(out).toContain('  slug: string;');
    expect(out).toContain('  body: string;');
    expect(out).toContain("  featured: 'true' | 'false';");
    expect(out).toContain('  publishedAt: string | null;');
    expect(out).toContain('  tags: string[];');
    expect(out).toContain('  coverImage: ResolvedImageField;');
    expect(out).toContain('  authors: AuthorEntry[];');
  });

  it('generates enums with select options', () => {
    const out = generateEnums(config, collections, fieldTypes);
    expect(out).toContain("Post: 'post',");
    expect(out).toContain("Author: 'author',");
    expect(out).toContain("COLLECTION_NAMES = ['post', 'author'] as const;");
  });

  it('generates content declarations with raw types', () => {
    const out = generateContentDecls(config, collections);
    expect(out).toContain('export interface RawPostFields {');
    // Markdown fields should be omitted from raw types
    expect(out).not.toMatch(/RawPostFields[\s\S]*?body:/);
    // Image should be string in raw mode
    expect(out).toContain('  coverImage: string;');
    // Reference should be string in raw mode
    expect(out).toContain('  authors: string;');
  });

  it('generates index barrel', () => {
    const out = generateIndex();
    expect(out).toContain("export * from './types'");
    expect(out).toContain("export * from './enums'");
  });
});
