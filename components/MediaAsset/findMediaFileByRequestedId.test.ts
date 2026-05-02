import { describe, expect, it } from 'vitest';

import type { MediaFile } from '../../types';
import { findMediaFileByRequestedId } from './findMediaFileByRequestedId';

const fixture: MediaFile = {
  id: '8dba94c7-f7ae-45a5-abe9-23aabfe3691f',
  title: 'A',
  originalName: 'a.png',
  path: 'public/media/8dba94c7-f7ae-45a5-abe9-23aabfe3691f.png',
  folder: '/',
  publicUrl: '/media/8dba94c7-f7ae-45a5-abe9-23aabfe3691f.png',
  extension: 'png',
  width: null,
  height: null,
  hasBlurPlaceholder: false,
};

describe('findMediaFileByRequestedId', () => {
  it('finds by direct id', () => {
    expect(findMediaFileByRequestedId(fixture.id, [fixture])?.id).toBe(fixture.id);
  });

  it('finds by media-<id> filename stem', () => {
    expect(findMediaFileByRequestedId(`media-${fixture.id}`, [fixture])?.id).toBe(fixture.id);
  });

  it('returns undefined when not found', () => {
    expect(findMediaFileByRequestedId('does-not-exist', [fixture])).toBeUndefined();
  });

  it('trims whitespace', () => {
    expect(findMediaFileByRequestedId(`  ${fixture.id}  `, [fixture])?.id).toBe(fixture.id);
  });
});
