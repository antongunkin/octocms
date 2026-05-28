import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { OCTOCMS_HTML_ID } from '../lib/cmsSurface';
import { OctoCmsSurfaceMarker } from './OctoCmsSurfaceMarker';

afterEach(() => {
  document.documentElement.removeAttribute('id');
  cleanup();
});

describe('OctoCmsSurfaceMarker', () => {
  it('sets html#octocms on mount', () => {
    render(<OctoCmsSurfaceMarker />);
    expect(document.documentElement.id).toBe(OCTOCMS_HTML_ID);
  });

  it('clears id on unmount when it was set by the marker', () => {
    const { unmount } = render(<OctoCmsSurfaceMarker />);
    expect(document.documentElement.id).toBe(OCTOCMS_HTML_ID);
    unmount();
    expect(document.documentElement.id).toBe('');
  });

  it('restores a prior html id on unmount', () => {
    document.documentElement.id = 'site-root';
    const { unmount } = render(<OctoCmsSurfaceMarker />);
    expect(document.documentElement.id).toBe(OCTOCMS_HTML_ID);
    unmount();
    expect(document.documentElement.id).toBe('site-root');
  });
});
