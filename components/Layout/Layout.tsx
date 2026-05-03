'use client';

import { signIn, useSession } from 'next-auth/react';
import React, { Suspense, useEffect } from 'react';
import { LogIn } from 'lucide-react';

import { useConfig } from '../../hooks/useConfig';
import type { Theme } from '../../admin/theme';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { TopHeader } from './TopHeader';
import { CommandK, useCommandK } from '../CommandK/CommandK';
import { AdminGenericSkeleton } from '../skeletons/AdminGenericSkeleton';

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
    <div
      id="cms-layout"
      className={cn('relative z-0 h-screen flex flex-col bg-background', initialTheme === 'light' && 'light')}
    >
      {session === null ? (
        <div className="min-h-screen flex items-center justify-center bg-muted/30">
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600">
              <span className="text-xl font-bold text-white">O</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">{config.projectName} CMS</h1>
            <p className="text-sm text-muted-foreground mb-8">Sign in to manage your content</p>
            <Button onClick={() => signIn('github', { callbackUrl: '/cms' })} size="lg">
              <LogIn className="w-4 h-4" />
              Sign in with GitHub
            </Button>
          </div>
        </div>
      ) : (
        <>
          <TopHeader onCommandK={() => setCmdkOpen(true)} initialTheme={initialTheme} />
          <main className="relative z-0 flex-1 flex min-h-0">
            {/* Inner Suspense so re-suspensions of the catch-all page (on
                navigation between sub-routes) don't blank the chrome. The
                generic skeleton fills the main slot until the per-branch
                Suspense inside `AdminApp` takes over with the right per-page
                skeleton. */}
            <Suspense fallback={<AdminGenericSkeleton />}>{children}</Suspense>
          </main>
          <CommandK open={cmdkOpen} onOpenChange={setCmdkOpen} />
        </>
      )}
    </div>
  );
};

export default Layout;
