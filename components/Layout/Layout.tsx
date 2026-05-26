'use client';

import { signIn, useSession } from 'next-auth/react';
import React, { Suspense, useEffect } from 'react';
import { Button, Icon } from '../ui';

import { useConfig } from '../../hooks/useConfig';
import type { Theme } from '../../admin/theme';
import { cn } from '../../lib/utils';
import { RouteMainSlotSkeleton } from '../Layout/skeletons/RouteMainSlotSkeleton';
import { TopHeader } from './TopHeader';
import { CommandK, useCommandK } from '../CommandK/CommandK';

type LayoutProps = {
  children: React.ReactNode;
  initialTheme: Theme;
};

const Layout = ({ children, initialTheme }: LayoutProps) => {
  const config = useConfig();
  const { data: session } = useSession();
  const { open: cmdkOpen, setOpen: setCmdkOpen } = useCommandK();

  useEffect(() => {
    document.body.classList.toggle('light', initialTheme === 'light');
    return () => {
      document.body.classList.remove('light');
    };
  }, [initialTheme]);

  return (
    <div id="cms-layout" className={cn('octo-layout', initialTheme === 'light' && 'light')}>
      {session === null ? (
        <div className="octo-layout__sign-in">
          <div className="octo-layout__sign-in-inner">
            <div className="octo-layout__sign-in-icon">O</div>
            <h1 className="octo-layout__sign-in-title">{config.projectName} CMS</h1>
            <p className="octo-layout__sign-in-subtitle">Sign in to manage your content</p>
            <Button onClick={() => signIn('github', { callbackUrl: '/cms' })} size="lg">
              <Icon.LogIn className="octo-icon-md" />
              Sign in with GitHub
            </Button>
          </div>
        </div>
      ) : (
        <>
          <TopHeader onCommandK={() => setCmdkOpen(true)} initialTheme={initialTheme} />
          <main className="octo-layout__main">
            {/* Catch-all `AdminApp` can suspend on `await params`. Keep `TopHeader`
                mounted; show route-matched page skeleton in the main slot instead of an
                empty flash, then route-specific TanStack Query skeletons take over. */}
            <Suspense fallback={<RouteMainSlotSkeleton />}>{children}</Suspense>
          </main>
          <CommandK open={cmdkOpen} onOpenChange={setCmdkOpen} />
        </>
      )}
    </div>
  );
};

export default Layout;
