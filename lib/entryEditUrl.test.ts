import { describe, expect, it } from 'vitest';

import { entryEditUrl } from './entryEditUrl';

describe('entryEditUrl', () => {
  it('routes media entries to /cms/media/<id>', () => {
    expect(entryEditUrl({ type: 'media', id: 'fdcdb5a8-a880-4995-a16d-75823c70ebbc' })).toBe(
      '/cms/media/fdcdb5a8-a880-4995-a16d-75823c70ebbc',
    );
  });

  it('routes other entries to /cms/content/<type>/<id>', () => {
    expect(entryEditUrl({ type: 'post', id: 'post-123' })).toBe('/cms/content/post/post-123');
  });

  it('treats only the literal "media" type as the media route — similarly named types stay under /cms/content', () => {
    expect(entryEditUrl({ type: 'multimedia', id: 'x' })).toBe('/cms/content/multimedia/x');
  });
});
