'use client';

import { useMutation } from '@tanstack/react-query';

import { previewSchemaChange, type PreviewSchemaResult } from '../../actions/schema';
import type { Config } from '../../types';

/**
 * Preview impact of a pending schema change. Uses `useMutation` rather than
 * `useQuery` because the result is one-shot per click ("Preview impact"
 * button) — there's no useful key to cache by, and re-running the preview
 * with the same `next` config is rare.
 *
 * Returns the full `PreviewSchemaResult` (validation + impact list) directly;
 * doesn't throw on `valid: false` because invalid schemas are a normal UI
 * state, not an error.
 */
export function useSchemaImpactPreview() {
  return useMutation<PreviewSchemaResult, Error, { next: Config }>({
    mutationFn: ({ next }) => previewSchemaChange(next),
  });
}
