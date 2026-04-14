import { describe, expect, it, vi } from 'vitest';

import { actionErr, actionOk, getEntryTitleField, getErrorMessage } from './utils';

const mockConfig = {
  collections: {
    post: {
      fields: {
        title: { format: 'string', entryTitle: true },
        body: { format: 'markdown' },
      },
    },
    homePage: {
      fields: {
        title: { format: 'string', entryTitle: true },
        body: { format: 'markdown' },
      },
    },
    item: {
      fields: {
        name: { format: 'string' },
        description: { format: 'markdown' },
      },
    },
  },
} as any;

vi.mock('../../lib/configStore', () => ({ getConfig: () => mockConfig }));

// ─── getErrorMessage ──────────────────────────────────────────────────────────

describe('getErrorMessage', () => {
  it('returns error.message for Error instances', () => {
    expect(getErrorMessage(new Error('something broke'))).toBe('something broke');
  });

  it('returns String() representation for non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string');
    expect(getErrorMessage(42)).toBe('42');
    expect(getErrorMessage(null)).toBe('null');
    expect(getErrorMessage(undefined)).toBe('undefined');
    expect(getErrorMessage({})).toBe('[object Object]');
  });
});

// ─── actionOk / actionErr ─────────────────────────────────────────────────────

describe('actionOk', () => {
  it('returns success: true', () => {
    expect(actionOk()).toEqual({ success: true });
  });
});

describe('actionErr', () => {
  it('maps Error instances via getErrorMessage', () => {
    expect(actionErr(new Error('network'))).toEqual({ success: false, error: 'network' });
  });

  it('maps non-Error values via getErrorMessage', () => {
    expect(actionErr('plain')).toEqual({ success: false, error: 'plain' });
    expect(actionErr(404)).toEqual({ success: false, error: '404' });
  });
});

// ─── getEntryTitleField ───────────────────────────────────────────────────────

describe('getEntryTitleField', () => {
  it('returns the field key marked as entryTitle', () => {
    expect(getEntryTitleField('post')).toBe('title');
    expect(getEntryTitleField('homePage')).toBe('title');
  });

  it('returns undefined when the collection has no entryTitle field', () => {
    expect(getEntryTitleField('item')).toBeUndefined();
  });

  it('returns undefined for unknown collection names', () => {
    expect(getEntryTitleField('nonExistent')).toBeUndefined();
  });
});
