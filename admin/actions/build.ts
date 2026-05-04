'use server';

import './registerConfig';

import { revalidatePath, revalidateTag, updateTag } from 'next/cache';

import { OCTOCMS_PUBLIC_CONTENT_CACHE_TAG } from '../../lib/publicContentCacheTag';

import { actionErr, actionOk, type ActionResult } from './utils';

/**
 * Invalidate public caches after content writes: one shared `"use cache"` tag for
 * all OctoCMS-driven public reads, plus root layout revalidation so App Router pages
 * under `/` pick up fresh RSC payloads without per-route config.
 *
 * Public site search (`GET /api/search`) is separate — built on demand from Git.
 */
export const buildJsons = async (_editedFileName?: string): Promise<ActionResult> => {
  try {
    try {
      updateTag(OCTOCMS_PUBLIC_CONTENT_CACHE_TAG);
    } catch {
      revalidateTag(OCTOCMS_PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
    }

    revalidatePath('/', 'layout');

    return actionOk();
  } catch (e) {
    return actionErr(e);
  }
};
