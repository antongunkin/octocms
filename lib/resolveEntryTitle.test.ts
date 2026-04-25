import { describe, expect, it } from 'vitest';

import type { Config } from '../admin/types';
import {
  buildEntryExcerpt,
  collectionFromPath,
  defaultEntryId,
  getEntryTitleField,
  resolveEntryId,
  resolveEntryTitle,
} from './resolveEntryTitle';

const config = {
  projectName: 'test',
  contentFolder: 'cms/content',
  mediaFolder: 'public/media',
  mediaAllowedFormats: [],
  git: { baseBranch: 'main' },
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { format: 'string', label: 'Title', entryTitle: true },
        body: { format: 'markdown', label: 'Body' },
        teaser: { format: 'text', label: 'Teaser' },
      },
    },
    media: {
      label: 'Media',
      hasMany: true,
      fields: {
        title: { format: 'string', label: 'Title' },
      },
    },
    homePage: {
      label: 'Home',
      fields: {
        heroTitle: { format: 'string', label: 'Hero', entryTitle: true },
      },
    },
    naked: {
      label: 'Naked',
      fields: { foo: { format: 'string', label: 'Foo' } },
    },
  },
} as unknown as Config;

describe('getEntryTitleField', () => {
  it('returns the field marked entryTitle: true', () => {
    expect(getEntryTitleField(config, 'post')).toBe('title');
    expect(getEntryTitleField(config, 'homePage')).toBe('heroTitle');
  });

  it('returns undefined when no field is marked', () => {
    expect(getEntryTitleField(config, 'naked')).toBeUndefined();
  });

  it('returns undefined for unknown collections', () => {
    expect(getEntryTitleField(config, 'mystery')).toBeUndefined();
  });
});

describe('defaultEntryId / collectionFromPath', () => {
  it('extracts the filename stem', () => {
    expect(defaultEntryId(config, 'cms/content/post/post-abc.json')).toBe('post-abc');
  });

  it('extracts the collection segment', () => {
    expect(collectionFromPath(config, 'cms/content/post/post-abc.json')).toBe('post');
  });
});

describe('resolveEntryTitle', () => {
  it('uses the entryTitle field when present', () => {
    expect(
      resolveEntryTitle(config, 'cms/content/post/post-abc.json', {
        sys: { type: 'post' },
        fields: { title: 'Hello world' },
      }),
    ).toBe('Hello world');
  });

  it('falls back to the filename stem when the title is empty', () => {
    expect(
      resolveEntryTitle(config, 'cms/content/post/post-abc.json', {
        sys: { type: 'post' },
        fields: { title: '   ' },
      }),
    ).toBe('post-abc');
  });

  it('uses media fields.title for media entries regardless of schema', () => {
    expect(
      resolveEntryTitle(config, 'cms/content/media/media-xyz.json', {
        sys: { type: 'media' },
        fields: { title: 'Sunset photo' },
      }),
    ).toBe('Sunset photo');
  });

  it('falls back to the filename stem when entry is null', () => {
    expect(resolveEntryTitle(config, 'cms/content/post/post-abc.json', null)).toBe('post-abc');
  });

  it('infers collection from path when sys.type is missing', () => {
    expect(
      resolveEntryTitle(config, 'cms/content/post/post-abc.json', {
        fields: { title: 'From path' },
      }),
    ).toBe('From path');
  });
});

describe('resolveEntryId', () => {
  it('returns sys.id for media entries', () => {
    expect(
      resolveEntryId(config, 'cms/content/media/media-xyz.json', {
        sys: { type: 'media', id: 'real-uuid' },
        fields: {},
      }),
    ).toBe('real-uuid');
  });

  it('returns the filename stem for non-media entries', () => {
    expect(
      resolveEntryId(config, 'cms/content/post/post-abc.json', {
        sys: { type: 'post', id: 'sys-id-ignored' },
        fields: {},
      }),
    ).toBe('post-abc');
  });
});

describe('buildEntryExcerpt', () => {
  it('returns the first non-title text-like field in schema order', () => {
    // Schema order is title, body, teaser → body wins (title is skipped).
    expect(
      buildEntryExcerpt(config, 'cms/content/post/p.json', {
        sys: { type: 'post' },
        fields: { title: 'T', teaser: 'A short teaser', body: 'Long body' },
      }),
    ).toBe('Long body');
  });

  it('skips empty fields and falls through to the next candidate', () => {
    expect(
      buildEntryExcerpt(config, 'cms/content/post/p.json', {
        sys: { type: 'post' },
        fields: { title: 'T', body: '   ', teaser: 'Teaser wins' },
      }),
    ).toBe('Teaser wins');
  });

  it('truncates with an ellipsis when over maxLen', () => {
    const long = 'a'.repeat(300);
    const out = buildEntryExcerpt(
      config,
      'cms/content/post/p.json',
      { sys: { type: 'post' }, fields: { title: 'T', teaser: long } },
      50,
    );
    expect(out.length).toBe(50);
    expect(out.endsWith('…')).toBe(true);
  });

  it('collapses whitespace', () => {
    expect(
      buildEntryExcerpt(config, 'cms/content/post/p.json', {
        sys: { type: 'post' },
        fields: { title: 'T', teaser: 'A\n\n  multiline\n\n  teaser' },
      }),
    ).toBe('A multiline teaser');
  });

  it('returns "" when no candidate field exists', () => {
    expect(
      buildEntryExcerpt(config, 'cms/content/post/p.json', {
        sys: { type: 'post' },
        fields: { title: 'T' },
      }),
    ).toBe('');
  });

  it('returns "" for unknown collections', () => {
    expect(
      buildEntryExcerpt(config, 'cms/content/mystery/m.json', {
        sys: { type: 'mystery' },
        fields: { foo: 'bar' },
      }),
    ).toBe('');
  });
});
