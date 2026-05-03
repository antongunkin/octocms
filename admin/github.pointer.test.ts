import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPublishedPointerRef } from './github';

const pointerState = vi.hoisted(() => ({
  publishedPointerBranch: undefined as string | undefined,
}));

const mockConfig = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  mediaContentFolder: 'cms/media',
  mediaFolder: 'public/media',
  mediaAllowedFormats: ['png'],
  git: {
    baseBranch: 'main',
    get publishedPointerBranch() {
      return pointerState.publishedPointerBranch;
    },
  },
  collections: {},
} as any;

vi.mock('../lib/configStore', () => ({ getConfig: () => mockConfig }));

describe('getPublishedPointerRef', () => {
  beforeEach(() => {
    pointerState.publishedPointerBranch = undefined;
  });

  it('returns undefined when unset', () => {
    expect(getPublishedPointerRef()).toBeUndefined();
  });

  it('returns undefined for whitespace-only', () => {
    pointerState.publishedPointerBranch = '   ';
    expect(getPublishedPointerRef()).toBeUndefined();
  });

  it('returns trimmed branch name', () => {
    pointerState.publishedPointerBranch = '  cms/publish-pointer  ';
    expect(getPublishedPointerRef()).toBe('cms/publish-pointer');
  });
});
