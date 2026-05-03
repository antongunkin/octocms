'use client';

import { useMemo } from 'react';

import type { MediaFile } from '../../../types';
import { getMediaEntries } from '../../actions/media';
import { findMediaFileByRequestedId } from '../../../components/MediaAsset/findMediaFileByRequestedId';
import { queryKeys } from '../keys';
import { useAdminQuery } from '../useAdminQuery';

export type UseMediaAssetResult = {
  asset: MediaFile | null;
  allFiles: MediaFile[];
  isLoading: boolean;
  isError: boolean;
};

/**
 * Single media asset by id. Derived from `useMediaList()` so the asset editor
 * shares the same cache as the library — switching between `/cms/media` and
 * `/cms/media/<id>` is one fetch, not two. Falls back to a direct fetch if
 * the list cache hasn't been populated yet.
 */
export function useMediaAsset(id: string): UseMediaAssetResult {
  const list = useAdminQuery({
    queryKey: queryKeys.media.list(),
    queryFn: () => getMediaEntries(),
  });
  const asset = useMemo(
    () => (list.data ? (findMediaFileByRequestedId(id, list.data) ?? null) : null),
    [list.data, id],
  );
  return {
    asset,
    allFiles: list.data ?? [],
    isLoading: list.isPending && !list.data,
    isError: list.isError,
  };
}
