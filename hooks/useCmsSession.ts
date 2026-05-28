'use client';

import { useQueryClient } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

import { useAdminQuery } from '../admin/query/useAdminQuery';
import { OCTOCMS_API } from '../lib/octocmsApiRoutes';
import type { CmsSessionPublic } from '../admin/auth/types';

export const CMS_SESSION_QUERY_KEY = ['cms', 'session'] as const;

async function fetchSession(): Promise<CmsSessionPublic | null> {
  const res = await fetch(OCTOCMS_API.auth.session, { credentials: 'same-origin' });
  if (res.status === 401) return null;
  if (!res.ok) {
    throw new Error('Failed to load session.');
  }
  return (await res.json()) as CmsSessionPublic;
}

export type CmsSessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

export function useCmsSession(): {
  data: CmsSessionPublic | null | undefined;
  status: CmsSessionStatus;
  signIn: () => void;
  signOut: () => Promise<void>;
} {
  const pathname = usePathname() ?? '/cms';
  const qc = useQueryClient();

  const query = useAdminQuery({
    queryKey: CMS_SESSION_QUERY_KEY,
    queryFn: fetchSession,
    tier: 'realtime',
    retry: false,
  });

  const status: CmsSessionStatus =
    query.isPending && query.data === undefined
      ? 'loading'
      : query.data
        ? 'authenticated'
        : 'unauthenticated';

  const signIn = useCallback(() => {
    const returnTo = encodeURIComponent(pathname);
    window.location.href = `${OCTOCMS_API.auth.login}?returnTo=${returnTo}`;
  }, [pathname]);

  const signOut = useCallback(async () => {
    await fetch(OCTOCMS_API.auth.logout, { method: 'POST', credentials: 'same-origin' });
    await qc.invalidateQueries({ queryKey: CMS_SESSION_QUERY_KEY });
    window.location.href = '/cms';
  }, [qc]);

  return {
    data: query.data,
    status,
    signIn,
    signOut,
  };
}
