/**
 * Canonical Next.js cache tag for public readers that load OctoCMS content under
 * `"use cache"`. After saves, `buildJsons()` calls `updateTag` with this value.
 *
 * Use `cacheTag(OCTOCMS_PUBLIC_CONTENT_CACHE_TAG)` in your cached loaders so they
 * all refresh together. Webhooks may call `GET /api/revalidate/<this-string>`.
 */
export const OCTOCMS_PUBLIC_CONTENT_CACHE_TAG = 'octocms:content';
