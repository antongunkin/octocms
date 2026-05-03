'use client';

import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';

import { attachCrossTabInvalidationListener } from './invalidate';
import { getQueryClient } from './queryClient';

/**
 * Wraps the admin tree in a `QueryClientProvider` and lazily mounts
 * `@tanstack/react-query-devtools` in development. Devtools is an optional
 * peer dep — if it's not installed the dynamic import simply rejects and the
 * provider keeps working.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => getQueryClient());
  const [Devtools, setDevtools] = useState<React.ComponentType<{ initialIsOpen?: boolean }> | null>(null);

  useEffect(() => {
    return attachCrossTabInvalidationListener(client);
  }, [client]);

  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    let cancelled = false;
    import('@tanstack/react-query-devtools')
      .then((m) => {
        if (!cancelled) setDevtools(() => m.ReactQueryDevtools);
      })
      .catch(() => {
        // Optional peer dep absent — silently skip.
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
