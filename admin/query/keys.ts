/**
 * Centralized query-key registry.
 *
 * Keys are tuples; the first element is the **domain** so a coarse
 * `invalidateQueries({ queryKey: ['entries'] })` covers every entries-related
 * query at once. Add new keys here rather than ad-hoc inline tuples — the
 * `invalidateAfterMutation` helper in `./invalidate.ts` reads this object.
 */
export const queryKeys = {
  entries: {
    all: ['entries'] as const,
    list: (collection?: string) => ['entries', 'list', collection ?? '*'] as const,
    detail: (filePath: string) => ['entries', 'detail', filePath] as const,
    commits: (filePath: string) => ['entries', 'commits', filePath] as const,
    backlinks: (referenceKey: string) => ['entries', 'backlinks', referenceKey] as const,
  },
  media: {
    all: ['media'] as const,
    list: () => ['media', 'list'] as const,
    asset: (id: string) => ['media', 'asset', id] as const,
  },
  schema: {
    all: ['schema'] as const,
    current: () => ['schema', 'current'] as const,
    impact: (proposalId: string) => ['schema', 'impact', proposalId] as const,
  },
  git: {
    all: ['git'] as const,
    branch: () => ['git', 'branch'] as const,
    hasActive: () => ['git', 'hasActive'] as const,
    branches: () => ['git', 'branches'] as const,
    isProduction: () => ['git', 'isProduction'] as const,
  },
  agent: {
    all: ['agent'] as const,
    status: () => ['agent', 'status'] as const,
  },
} as const;
