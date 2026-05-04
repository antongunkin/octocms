/**
 * Route Handler for the public site's `GET /api/search` endpoint, consumed by
 * the `SearchBox` component shipped at `octocms/components/public`. The user-
 * app file at `src/app/api/search/route.ts` (or `app/api/search/route.ts`)
 * is a thin re-export of `searchRoute` plus a side-effect import of
 * `cms/__generated__/configInit`. `octocms init` / `octocms update`
 * scaffold that re-export via `searchRouteTemplate` in
 * `octocms/cli/lib/templates.ts`.
 *
 * The handler reads `config.search.publicCollections` to decide what's
 * searchable, builds (or loads) a MiniSearch index via
 * `loadPublicSearchIndexJson`, queries it, and filters results down to
 * collections the public site exposes. Returns `{ results: [] }` with 404
 * when search is disabled, or 500 on internal errors.
 */

import { getConfig } from '../lib/configStore';
import { loadPublicSearchIndexJson } from '../lib/publicSearchIndex';
import { querySearchIndex, type SearchResult } from '../lib/searchIndex';

/** Module-level cache for the serialised search index. */
let cachedIndexJson: string | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadSearchIndex(): Promise<string | null> {
  if (cachedIndexJson && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndexJson;
  }

  const indexJson = await loadPublicSearchIndexJson();
  if (indexJson) {
    cachedIndexJson = indexJson;
    cacheLoadedAt = Date.now();
  }

  return indexJson;
}

export async function searchRoute(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') ?? '';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100);

    const publicCollections = getConfig().search?.publicCollections;
    if (!publicCollections || Object.keys(publicCollections).length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const indexJson = await loadSearchIndex();
    if (!indexJson) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let results: SearchResult[] = [];
    try {
      results = querySearchIndex(indexJson, query, limit);
    } catch {
      // Index format might be invalid; return empty results
    }

    const publicCollectionKeys = Object.keys(publicCollections);
    const filtered = results.filter((r) => publicCollectionKeys.includes(r.type) && r.url !== '');

    return new Response(JSON.stringify({ results: filtered }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
