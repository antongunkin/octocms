'use client';

import { useLayoutEffect } from 'react';

import { OCTOCMS_HTML_ID } from '../lib/cmsSurface';

/** Sets html#octocms while an OctoCMS surface (admin or /design) is mounted. */
export function OctoCmsSurfaceMarker() {
  useLayoutEffect(() => {
    const el = document.documentElement;
    const prevId = el.id;
    el.id = OCTOCMS_HTML_ID;
    return () => {
      if (el.id === OCTOCMS_HTML_ID) {
        el.id = prevId;
      }
    };
  }, []);
  return null;
}
