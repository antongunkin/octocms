import { normalizeStoredSlug } from './slugField';

/** Public path for a blog post when `fields.slug` is set (normalized). */
export function getPostBlogPublicPath(entry: unknown): string | null {
  if (!entry || typeof entry !== 'object') return null;
  const { sys, fields } = entry as { sys?: { type?: string }; fields?: Record<string, unknown> };
  if (sys?.type !== 'post') return null;
  const slug = fields?.slug;
  if (typeof slug !== 'string' || !slug.trim()) return null;
  const n = normalizeStoredSlug(slug);
  if (!n) return null;
  return `/blog/${n}`;
}

export function postSlugMatchesUrlParam(storedSlug: string | undefined, urlParam: string): boolean {
  if (typeof storedSlug !== 'string' || !storedSlug.trim()) return false;
  return normalizeStoredSlug(storedSlug) === normalizeStoredSlug(urlParam);
}
