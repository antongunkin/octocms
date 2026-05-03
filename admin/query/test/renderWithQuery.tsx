import React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * Build a `QueryClient` suitable for tests: retries off (so a thrown
 * `mutationFn` rejects immediately), cache cleared between tests via fresh
 * client per call.
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // Tests assert cache behavior deterministically; no background refetch on remount.
        staleTime: Number.POSITIVE_INFINITY,
        gcTime: Number.POSITIVE_INFINITY,
      },
      mutations: { retry: false },
    },
  });
}

type Options = Omit<RenderOptions, 'wrapper'> & { client?: QueryClient };

export function renderWithQuery(
  ui: React.ReactElement,
  { client = createTestQueryClient(), ...options }: Options = {},
): RenderResult & { client: QueryClient } {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { ...render(ui, { wrapper: Wrapper, ...options }), client };
}

/** Wrapper factory for `renderHook`. */
export function withQuery(client: QueryClient = createTestQueryClient()) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  }
  return { Wrapper, client };
}
