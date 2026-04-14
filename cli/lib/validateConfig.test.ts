import { describe, expect, it } from 'vitest';
import { validateConfig } from './validateConfig';
import type { Config } from '../../types';

function makeConfig(overrides: Partial<Config> = {}): Config {
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
          title: { label: 'Title', format: 'string', entryTitle: true },
        },
      },
    },
    ...overrides,
  };
}

describe('validateConfig', () => {
  it('passes for a valid config', () => {
    expect(() => validateConfig(makeConfig(), ['post'])).not.toThrow();
  });

  it('throws for missing collection', () => {
    expect(() => validateConfig(makeConfig(), ['post', 'nonexistent'])).toThrow(
      'collection "nonexistent" is listed but not defined',
    );
  });

  it('throws for empty fields', () => {
    const cfg = makeConfig({
      collections: {
        post: { label: 'Post', fields: {} },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('must have at least one field');
  });

  it('throws for invalid field identifier', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            'bad-name': { label: 'Bad', format: 'string' },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('not a valid TypeScript identifier');
  });

  it('throws for list: true on non-string format', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            count: { label: 'Count', format: 'number', list: true } as any,
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('list: true but format is not "string"');
  });

  it('validates slug field needs slugSource or entryTitle', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            slug: { label: 'Slug', format: 'slug' },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('needs slugSource or exactly one entryTitle field');
  });

  it('validates select options are unique', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: {
              label: 'Status',
              format: 'select',
              options: [
                { label: 'A', value: 'a' },
                { label: 'B', value: 'a' },
              ],
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('unique values');
  });

  it('validates reference collections exist', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            author: {
              label: 'Author',
              format: 'reference',
              reference: { collections: ['nonexistent'] },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('unknown collection "nonexistent"');
  });

  it('validates conditional branches have unique keys', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            hero: {
              label: 'Hero',
              format: 'conditional',
              conditional: {
                branches: [
                  { key: 'a', label: 'A', fields: { x: { label: 'X', format: 'string' } } },
                  { key: 'a', label: 'A2', fields: { y: { label: 'Y', format: 'string' } } },
                ],
              },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('duplicated');
  });
});
