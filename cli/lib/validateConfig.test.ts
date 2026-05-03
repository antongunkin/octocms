import { describe, expect, it } from 'vitest';
import { validateConfig } from './validateConfig';
import type { Config } from '../../types';

function makeConfig(overrides: Partial<Config> = {}): Config {
  return {
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
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

  it('passes for slug field with valid slugSource', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            title: { label: 'Title', format: 'string', entryTitle: true },
            slug: { label: 'Slug', format: 'slug', slugSource: 'title' },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).not.toThrow();
  });

  it('throws for slug field with slugSource pointing at a non-string/text field', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            count: { label: 'Count', format: 'number' },
            slug: { label: 'Slug', format: 'slug', slugSource: 'count' },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('slugSource must name a non-list string or text field');
  });

  it('throws for select field with no options', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: { label: 'Status', format: 'select', options: [] } as any,
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('select field needs at least one option');
  });

  it('throws when defaultOption is not among select options', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: {
              label: 'Status',
              format: 'select',
              options: [{ label: 'A', value: 'a' }],
              defaultOption: 'nope',
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('defaultOption is not among options');
  });

  it('throws when defaultOptions is used on a single-select field', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: {
              label: 'Status',
              format: 'select',
              options: [{ label: 'A', value: 'a' }],
              defaultOptions: ['a'],
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('use defaultOption for single select');
  });

  it('throws when defaultOption is used on a multi-select field', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: {
              label: 'Status',
              format: 'select',
              options: [{ label: 'A', value: 'a' }],
              multiple: true,
              defaultOption: 'a',
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('use defaultOptions with multiple');
  });

  it('throws when defaultOptions value is not among multi-select options', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            status: {
              label: 'Status',
              format: 'select',
              options: [{ label: 'A', value: 'a' }],
              multiple: true,
              defaultOptions: ['nope'],
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('defaultOptions value "nope" is not an option');
  });

  it('throws when reference cardinality is an invalid value', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            author: {
              label: 'Author',
              format: 'reference',
              reference: { cardinality: 'maybe' as any },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('reference.cardinality must be "one" or "many"');
  });

  it('throws when legacy collection prop targets unknown collection', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            author: {
              label: 'Author',
              format: 'reference',
              collection: 'nonexistent',
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('legacy collection prop references unknown collection');
  });

  it('throws when conditional reference branch targets unknown collection', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            hero: {
              label: 'Hero',
              format: 'conditional',
              conditional: {
                branches: [{ key: 'ref', label: 'Ref', collection: 'nonexistent' }],
              },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('references unknown collection "nonexistent"');
  });

  it('recursively validates inline fields inside conditional branches', () => {
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
                  { key: 'inline', label: 'Inline', fields: { 'bad-name': { label: 'Bad', format: 'string' } } },
                ],
              },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('not a valid TypeScript identifier');
  });

  it('throws when conditional field has no branches', () => {
    const cfg = makeConfig({
      collections: {
        post: {
          label: 'Post',
          fields: {
            hero: {
              label: 'Hero',
              format: 'conditional',
              conditional: { branches: [] },
            },
          },
        },
      },
    });
    expect(() => validateConfig(cfg, ['post'])).toThrow('conditional field must have at least one branch');
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
