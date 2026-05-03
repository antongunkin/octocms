import '../../globals.css';
import '@mdxeditor/editor/style.css';
import type { Metadata } from 'next';
import React, { Suspense } from 'react';

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

  // No Suspense around `<Layout>{children}</Layout>` here on purpose: the
  // catch-all page (`AdminApp`) re-suspends on every back/forward navigation,
  // and a Suspense at this level would blank the entire layout chrome
  // (including the TopHeader). Layout itself owns the inner Suspense around
  // `{children}` so the chrome stays mounted and the generic admin skeleton
  // fills the main slot.
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
    <Suspense fallback={null}>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
};
