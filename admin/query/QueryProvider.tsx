'use client';

import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { attachCrossTabInvalidationListener } from './invalidate';
import { getQueryClient } from './queryClient';

/**
 * Wraps the admin tree in a `QueryClientProvider`.
 *
 * `@tanstack/react-query-devtools` is intentionally NOT loaded here.
 * Browser ESM cannot resolve bare specifiers at runtime, so any "auto-detect
 * if installed" pattern requires either bundler resolution (which fails the
 * build when the dep is absent) or magic comments / `new Function` (which
 * silence the bundler but then fail in the browser). Both create more
 * problems than they solve.
 *
 * Consumers who want devtools install `@tanstack/react-query-devtools` and
 * mount `<ReactQueryDevtools />` themselves alongside their admin tree —
 * see [docs/getting-started.md](../../../docs/getting-started.md) for the
 * three-line wrapper pattern. The OctoCMS dev repo does this in
 * `src/app/cms/[[...path]]/page.tsx`.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());

  useEffect(() => {
    return attachCrossTabInvalidationListener(client);
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
