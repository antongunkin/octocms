import { afterEach, describe, expect, it, vi } from 'vitest';

import { isMediaEntryPath, mediaContentFolder, mediaEntryPath } from './mediaPath';

const mockConfig: { mediaContentFolder?: string } = { mediaContentFolder: 'cms/media' };

vi.mock('./configStore', () => ({
  getConfig: () => mockConfig,
}));

afterEach(() => {
  mockConfig.mediaContentFolder = 'cms/media';
});

describe('mediaContentFolder', () => {
  it('returns the configured folder', () => {
    expect(mediaContentFolder()).toBe('cms/media');
  });

  it('falls back to cms/media when the config is missing', () => {
    mockConfig.mediaContentFolder = undefined;
    expect(mediaContentFolder()).toBe('cms/media');
  });

  it('falls back when the config is an empty string', () => {
    mockConfig.mediaContentFolder = '   ';
    expect(mediaContentFolder()).toBe('cms/media');
  });

  it('respects a custom folder', () => {
    mockConfig.mediaContentFolder = 'data/assets';
    expect(mediaContentFolder()).toBe('data/assets');
  });
});

describe('mediaEntryPath', () => {
  it('builds the canonical media-entry path', () => {
    expect(mediaEntryPath('abc-123')).toBe('cms/media/media-abc-123.json');
  });

  it('uses the custom folder when configured', () => {
    mockConfig.mediaContentFolder = 'data/assets';
    expect(mediaEntryPath('xyz')).toBe('data/assets/media-xyz.json');
  });
});

describe('isMediaEntryPath', () => {
  it('returns true for paths under the media folder', () => {
    expect(isMediaEntryPath('cms/media/media-abc.json')).toBe(true);
  });

  it('returns false for editorial content paths', () => {
    expect(isMediaEntryPath('cms/content/post/post-1.json')).toBe(false);
  });

  it('returns false for paths that merely contain "/media/"', () => {
    // The legacy `cms/content/media/...` location is no longer the media root,
    // so it should NOT be classified as a media entry path.
    expect(isMediaEntryPath('cms/content/media/media-abc.json')).toBe(false);
  });
});
