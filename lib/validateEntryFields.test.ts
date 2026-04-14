import { describe, expect, it, vi } from 'vitest';

import { validateEntryFields } from './validateEntryFields';

const mockConfig = {
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        body: { label: 'Body', format: 'markdown', required: false },
        cover: { label: 'Cover', format: 'image', required: true },
      },
    },
    blogRefRequired: {
      label: 'Blog',
      fields: {
        title: { label: 'Blog title', format: 'string', required: true },
        posts: {
          label: 'Posts',
          format: 'reference',
          required: true,
          reference: { collections: ['post'], cardinality: 'many' },
        },
      },
    },
    blogOptional: {
      label: 'Blog',
      fields: {
        title: { label: 'Blog title', format: 'string', required: true },
        posts: {
          label: 'Posts',
          format: 'reference',
          reference: { collections: ['post'], cardinality: 'many' },
        },
      },
    },
    withNumber: {
      label: 'With number',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        qty: {
          label: 'Quantity',
          format: 'number',
          required: true,
          valueType: 'int',
          min: 1,
          max: 5,
        },
      },
    },
    withDatetime: {
      label: 'With datetime',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        publishedAt: { label: 'Published', format: 'datetime', required: true, dateOnly: true },
        optionalAt: { label: 'Optional at', format: 'datetime', dateOnly: true },
      },
    },
    withSelectSingle: {
      label: 'With select',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        status: {
          label: 'Status',
          format: 'select',
          required: true,
          options: [
            { label: 'A', value: 'a' },
            { label: 'B', value: 'b' },
          ],
        },
        tag: {
          label: 'Tag',
          format: 'select',
          options: [{ label: 'X', value: 'x' }],
        },
      },
    },
    withSelectMulti: {
      label: 'With multiselect',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        groups: {
          label: 'Groups',
          format: 'select',
          multiple: true,
          required: true,
          options: [
            { label: 'G1', value: 'g1' },
            { label: 'G2', value: 'g2' },
          ],
        },
        extras: {
          label: 'Extras',
          format: 'select',
          multiple: true,
          options: [{ label: 'E1', value: 'e1' }],
        },
      },
    },
    withStringList: {
      label: 'With string list',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        tags: { label: 'Tags', format: 'string', list: true },
        labelsReq: { label: 'Labels', format: 'string', list: true, required: true },
      },
    },
    withTextUrlColor: {
      label: 'With text url color',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', required: true },
        bio: { label: 'Bio', format: 'text', required: false },
        bioReq: { label: 'Bio req', format: 'text', required: true },
        link: { label: 'Link', format: 'url', required: false },
        linkReq: { label: 'Link req', format: 'url', required: true },
        accent: { label: 'Accent', format: 'color', required: false },
        accentReq: { label: 'Accent req', format: 'color', required: true },
      },
    },
  },
} as any;

vi.mock('./configStore', () => ({
  getConfig: () => mockConfig,
}));

describe('validateEntryFields', () => {
  it('passes when required string and image are filled', () => {
    const r = validateEntryFields('post', {
      title: 'Hello',
      body: '',
      cover: 'uuid-1',
    });
    expect(r).toEqual({ ok: true });
  });

  it('fails when required string is empty or whitespace', () => {
    const r = validateEntryFields('post', { title: '   ', body: '', cover: 'x' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.title).toBe('Title is required');
    }
  });

  it('fails when required image is empty', () => {
    const r = validateEntryFields('post', { title: 'T', body: '', cover: '' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.cover).toBe('Cover is required');
    }
  });

  it('requires at least one reference when field is required', () => {
    const r = validateEntryFields('blogRefRequired', {
      title: 'B',
      posts: '[]',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.fieldErrors.posts).toBe('Posts is required');
    }
  });

  it('allows empty optional reference list', () => {
    const r = validateEntryFields('blogOptional', {
      title: 'B',
      posts: '[]',
    });
    expect(r).toEqual({ ok: true });
  });

  it('validates required number and range', () => {
    const empty = validateEntryFields('withNumber', { title: 'T', qty: '' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors.qty).toBe('Quantity is required');

    const bad = validateEntryFields('withNumber', { title: 'T', qty: '10' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors.qty).toContain('at most');

    const ok = validateEntryFields('withNumber', { title: 'T', qty: '3' });
    expect(ok).toEqual({ ok: true });
  });

  it('parses optional string list and allows empty array', () => {
    const r = validateEntryFields('withStringList', {
      title: 'T',
      tags: '[]',
      labelsReq: '["a"]',
    });
    expect(r).toEqual({ ok: true });
  });

  it('requires at least one string when string list is required', () => {
    const r = validateEntryFields('withStringList', {
      title: 'T',
      tags: '[]',
      labelsReq: '[]',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.labelsReq).toBe('Labels is required');
  });

  it('rejects invalid JSON for string list', () => {
    const r = validateEntryFields('withStringList', {
      title: 'T',
      tags: 'not-json',
      labelsReq: '["x"]',
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors.tags).toBe('Invalid list data');
  });

  it('validates required date-only datetime', () => {
    const empty = validateEntryFields('withDatetime', { title: 'T', publishedAt: '', optionalAt: '' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors.publishedAt).toBe('Published is required');

    const bad = validateEntryFields('withDatetime', { title: 'T', publishedAt: 'x', optionalAt: '' });
    expect(bad.ok).toBe(false);

    const ok = validateEntryFields('withDatetime', {
      title: 'T',
      publishedAt: '2024-02-01',
      optionalAt: '',
    });
    expect(ok).toEqual({ ok: true });
  });

  it('validates required single select', () => {
    const empty = validateEntryFields('withSelectSingle', { title: 'T', status: '', tag: '' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors.status).toBe('Status is required');

    const bad = validateEntryFields('withSelectSingle', { title: 'T', status: 'z', tag: '' });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.fieldErrors.status).toBe('Status has an invalid choice');

    const ok = validateEntryFields('withSelectSingle', { title: 'T', status: 'a', tag: '' });
    expect(ok).toEqual({ ok: true });
  });

  it('allows empty optional single select', () => {
    const r = validateEntryFields('withSelectSingle', { title: 'T', status: 'b', tag: '' });
    expect(r).toEqual({ ok: true });
  });

  it('validates multiselect JSON and allowed values', () => {
    const empty = validateEntryFields('withSelectMulti', { title: 'T', groups: '[]', extras: '[]' });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.fieldErrors.groups).toBe('Groups is required');

    const badJson = validateEntryFields('withSelectMulti', { title: 'T', groups: 'not-json', extras: '[]' });
    expect(badJson.ok).toBe(false);
    if (!badJson.ok) expect(badJson.fieldErrors.groups).toBe('Groups has invalid data');

    const notArray = validateEntryFields('withSelectMulti', { title: 'T', groups: '"g1"', extras: '[]' });
    expect(notArray.ok).toBe(false);
    if (!notArray.ok) expect(notArray.fieldErrors.groups).toBe('Groups must be a JSON array');

    const badVal = validateEntryFields('withSelectMulti', { title: 'T', groups: '["g1","xx"]', extras: '[]' });
    expect(badVal.ok).toBe(false);
    if (!badVal.ok) expect(badVal.fieldErrors.groups).toBe('Groups contains an invalid choice');

    const ok = validateEntryFields('withSelectMulti', { title: 'T', groups: '["g1"]', extras: '[]' });
    expect(ok).toEqual({ ok: true });
  });

  it('validates text, url, and color fields', () => {
    const ok = validateEntryFields('withTextUrlColor', {
      title: 'T',
      bio: '  hello  ',
      bioReq: 'x',
      link: '',
      linkReq: 'https://a',
      accent: '',
      accentReq: '#abc',
    });
    expect(ok).toEqual({ ok: true });

    const badUrl = validateEntryFields('withTextUrlColor', {
      title: 'T',
      bio: '',
      bioReq: 'x',
      link: 'ftp://x',
      linkReq: 'https://a',
      accent: '',
      accentReq: '#000000',
    });
    expect(badUrl.ok).toBe(false);
    if (!badUrl.ok) expect(badUrl.fieldErrors.link).toContain('http');

    const badColor = validateEntryFields('withTextUrlColor', {
      title: 'T',
      bio: '',
      bioReq: 'x',
      link: '',
      linkReq: 'https://a',
      accent: 'nope',
      accentReq: '#000000',
    });
    expect(badColor.ok).toBe(false);
    if (!badColor.ok) expect(badColor.fieldErrors.accent).toContain('hex');

    const reqText = validateEntryFields('withTextUrlColor', {
      title: 'T',
      bio: '',
      bioReq: '   ',
      link: '',
      linkReq: '/',
      accent: '',
      accentReq: '#fff',
    });
    expect(reqText.ok).toBe(false);
    if (!reqText.ok) expect(reqText.fieldErrors.bioReq).toBe('Bio req is required');
  });
});
