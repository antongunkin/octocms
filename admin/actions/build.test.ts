import { revalidatePath, revalidateTag, updateTag } from 'next/cache';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OCTOCMS_PUBLIC_CONTENT_CACHE_TAG } from '../../lib/publicContentCacheTag';
import { buildJsons } from './build';

beforeEach(() => {
  vi.clearAllMocks();
});

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
}));

// ─── buildJsons ───────────────────────────────────────────────────────────────

describe('buildJsons', () => {
  it('returns success', async () => {
    const result = await buildJsons();
    expect(result).toEqual({ success: true });
  });

  it('updates the shared OctoCMS public content cache tag', async () => {
    await buildJsons();

    expect(updateTag).toHaveBeenCalledTimes(1);
    expect(updateTag).toHaveBeenCalledWith(OCTOCMS_PUBLIC_CONTENT_CACHE_TAG);
  });

  it('revalidates the root layout (all pages under /)', async () => {
    await buildJsons();

    expect(revalidatePath).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('falls back to revalidateTag when updateTag throws (Route Handler context)', async () => {
    vi.mocked(updateTag).mockImplementation(() => {
      throw new Error('updateTag can only be called from within a Server Action');
    });

    const result = await buildJsons();
    expect(result).toEqual({ success: true });

    expect(revalidateTag).toHaveBeenCalledTimes(1);
    expect(revalidateTag).toHaveBeenCalledWith(OCTOCMS_PUBLIC_CONTENT_CACHE_TAG, { expire: 0 });
  });
});
