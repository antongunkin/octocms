/**
 * Centralized query-key registry. Keys are tuples; the first element is the
 * "domain" so `invalidateQueries({ queryKey: ['entries'] })` invalidates every
 * entries-related query at once.
 */
export const queryKeys = {
  entries: {
    all: ['entries'] as const,
    list: (collection?: string) => ['entries', 'list', collection ?? '*'] as const,
  },
  git: {
    all: ['git'] as const,
    branch: () => ['git', 'branch'] as const,
    hasActive: () => ['git', 'hasActive'] as const,
  },
} as const;
