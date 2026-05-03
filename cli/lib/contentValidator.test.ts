import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validateContent } from './contentValidator';
import type { Config } from '../../types';

const TMP_DIR = join(process.cwd(), '.tmp-validate-test');

function makeConfig(collections: Config['collections'] = {}): Config {
  return {
    projectName: 'Test',
    contentFolder: 'content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png'],
    git: { baseBranch: 'main' },
    collections,
  };
}

function writeEntry(collection: string, fileName: string, data: unknown): void {
  const dir = join(TMP_DIR, 'content', collection);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fileName), JSON.stringify(data), 'utf8');
}

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validateContent', () => {
  it('returns no errors for valid entries', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        hasMany: true,
        fields: {
          title: { label: 'Title', format: 'string', required: true },
        },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post', status: 'draft' },
      fields: { title: 'Hello' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toEqual([]);
    expect(result.counts.post).toBe(1);
  });

  it('reports missing sys.id', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { title: { label: 'Title', format: 'string' } } },
    });
    writeEntry('post', 'post-1.json', {
      sys: { type: 'post' },
      fields: { title: 'Hello' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(expect.objectContaining({ message: 'Missing sys.id' }));
  });

  it('reports wrong sys.type', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { title: { label: 'Title', format: 'string' } } },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'wrong' },
      fields: { title: 'Hello' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('expected "post"') }),
    );
  });

  it('reports missing required field', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: { title: { label: 'Title', format: 'string', required: true } },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { title: '' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'title', message: expect.stringContaining('Required') }),
    );
  });

  it('reports wrong field type for string', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { title: { label: 'Title', format: 'string' } } },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { title: 42 },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'title', message: 'Expected string' }));
  });

  it('validates boolean field', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { active: { label: 'Active', format: 'boolean' } } },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { active: 'maybe' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'active', message: expect.stringContaining('"true" or "false"') }),
    );
  });

  it('validates number field min/max', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: { count: { label: 'Count', format: 'number', min: 0, max: 10 } },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { count: 15 },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'count', message: expect.stringContaining('above max') }),
    );
  });

  it('validates select field options', () => {
    const config = makeConfig({
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
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { status: 'invalid' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'status', message: expect.stringContaining('Invalid select value') }),
    );
  });

  it('validates datetime format', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: { date: { label: 'Date', format: 'datetime' } },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { date: 'not-a-date' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ field: 'date', message: 'Invalid datetime format' }),
    );
  });

  it('validates string list field', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: { tags: { label: 'Tags', format: 'string', list: true } },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { tags: 'not-an-array' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(expect.objectContaining({ field: 'tags', message: 'Expected string array' }));
  });

  it('reports invalid JSON files', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { title: { label: 'Title', format: 'string' } } },
    });
    const dir = join(TMP_DIR, 'content', 'post');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'post-bad.json'), '{ broken json', 'utf8');

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(expect.objectContaining({ message: 'Invalid JSON' }));
  });

  it('reports missing reference targets', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: {
          author: {
            label: 'Author',
            format: 'reference',
            reference: { collections: ['author'], cardinality: 'one' },
          },
        },
      },
      author: {
        label: 'Author',
        fields: { name: { label: 'Name', format: 'string' } },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { author: 'author-999.json' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toContainEqual(
      expect.objectContaining({ message: expect.stringContaining('does not exist') }),
    );
  });

  it('passes when reference target exists', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: {
          author: {
            label: 'Author',
            format: 'reference',
            reference: { collections: ['author'], cardinality: 'one' },
          },
        },
      },
      author: {
        label: 'Author',
        fields: { name: { label: 'Name', format: 'string' } },
      },
    });
    writeEntry('author', 'author-1.json', {
      sys: { id: '1', type: 'author' },
      fields: { name: 'Alice' },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { author: 'author-1.json' },
    });

    const result = validateContent(TMP_DIR, config);
    const refErrors = result.errors.filter((e) => e.field === 'author');
    expect(refErrors).toEqual([]);
  });

  it('counts entries per collection', () => {
    const config = makeConfig({
      post: { label: 'Post', fields: { title: { label: 'Title', format: 'string' } } },
      page: { label: 'Page', fields: { title: { label: 'Title', format: 'string' } } },
    });
    writeEntry('post', 'post-1.json', { sys: { id: '1', type: 'post' }, fields: { title: 'A' } });
    writeEntry('post', 'post-2.json', { sys: { id: '2', type: 'post' }, fields: { title: 'B' } });

    const result = validateContent(TMP_DIR, config);
    expect(result.counts.post).toBe(2);
    expect(result.counts.page).toBe(0);
  });

  it('skips markdown/richtext fields in JSON validation', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: {
          title: { label: 'Title', format: 'string' },
          body: { label: 'Body', format: 'markdown' },
        },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { title: 'Hello' },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toEqual([]);
  });

  it('accepts null for optional number/datetime', () => {
    const config = makeConfig({
      post: {
        label: 'Post',
        fields: {
          count: { label: 'Count', format: 'number' },
          date: { label: 'Date', format: 'datetime' },
        },
      },
    });
    writeEntry('post', 'post-1.json', {
      sys: { id: '1', type: 'post' },
      fields: { count: null, date: null },
    });

    const result = validateContent(TMP_DIR, config);
    expect(result.errors).toEqual([]);
  });
});
