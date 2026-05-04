'use client';

import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { attachCrossTabInvalidationListener } from './invalidate';
import { getQueryClient } from './queryClient';

type DevtoolsComponent = React.ComponentType<{ initialIsOpen?: boolean }>;

/**
 * Best-effort loader for the optional `@tanstack/react-query-devtools` peer
 * dep. Uses the `Function` constructor so bundlers (Webpack / Turbopack /
 * Rspack) physically cannot trace the import — a missing dep cannot break
 * the consumer's build.
 *
 * Failure modes (all silent):
 *   - Production: skipped by the caller.
 *   - CSP forbids `unsafe-eval`: `new Function` throws — caught here.
 *   - Dep not installed: dynamic `import()` rejects — caught by `.catch`.
 *   - Wrong export shape: `mod.ReactQueryDevtools` undefined — guarded.
 */
type DevtoolsModule = { ReactQueryDevtools?: DevtoolsComponent };
type DynImport = (moduleName: string) => Promise<DevtoolsModule>;

function loadDevtools(): Promise<DevtoolsComponent | null> {
  let dynImport: DynImport;
  try {
    dynImport = new Function('m', 'return import(m)') as unknown as DynImport;
  } catch {
    // CSP environment without `unsafe-eval` — devtools just won't appear.
    return Promise.resolve(null);
  }
  return dynImport('@tanstack/react-query-devtools')
    .then((mod) => mod.ReactQueryDevtools ?? null)
    .catch(() => null);
}

/**
 * Wraps the admin tree in a `QueryClientProvider` and, in development only,
 * lazily mounts `@tanstack/react-query-devtools` if it is installed.
 *
 * The devtools dep is **not** declared in `peerDependencies` — it is loaded
 * via `loadDevtools()` (Function-constructor `import()`) so the consumer's
 * bundler never sees the specifier. Install it in your project to see the
 * floating panel; do nothing to ignore it.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());
  const [Devtools, setDevtools] = useState<DevtoolsComponent | null>(null);

  useEffect(() => {
    return attachCrossTabInvalidationListener(client);
  }, [client]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let cancelled = false;
    loadDevtools().then((Component) => {
      if (!cancelled && Component) setDevtools(() => Component);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <QueryClientProvider client={client}>
      {children}
      {Devtools ? <Devtools initialIsOpen={false} /> : null}
    </QueryClientProvider>
  );
}
