import '../../globals.css';
import '@mdxeditor/editor/style.css';
import type { Metadata } from 'next';
import React, { Suspense } from 'react';

import { AdminBootstrapSkeleton } from '../../components/skeletons';
import Provider from '../provider';
import { Toaster } from '../../components/ui/toaster';
import Layout from '../../components/Layout/Layout';
import { getThemeCookie } from '../theme/cookie';
import { getConfig } from '../../lib/configStore';

export const metadata: Metadata = {
  title: 'OctoCMS',
};

/**
 * Async inner component that reads the `cms-theme` cookie.
 *
 * Kept separate from `AdminLayout` so the `cookies()` call (uncached dynamic
 * data) happens inside a `<Suspense>` boundary. This satisfies the
 * `cacheComponents` experimental flag requirement: any uncached data access
 * must be wrapped in Suspense, and avoids the need for `force-dynamic` (which
 * is incompatible with `cacheComponents`).
 */
async function AdminLayoutInner({ children }: Readonly<{ children: React.ReactNode }>) {
  const initialTheme = await getThemeCookie();
  const config = getConfig();

  // No Suspense around `<Layout>{children}</Layout>` here: the catch-all page
  // suspends inside the client `Layout` `<main>` boundary so `TopHeader` stays
  // mounted. `AdminLayout`'s outer `<Suspense>` only wraps this async inner
  // (cookie read) and shows `AdminBootstrapSkeleton` until providers mount.
  return (
    <Provider config={config}>
      <Layout initialTheme={initialTheme}>{children}</Layout>
      <Toaster />
    </Provider>
  );
}

/**
 * Synchronous CMS layout shell.
 * Wraps `AdminLayoutInner` in `<Suspense>` so the async cookie read is
 * inside the boundary and does not block the rest of the page.
 */
export const AdminLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => {
  return (
    <Suspense fallback={<AdminBootstrapSkeleton />}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
};
