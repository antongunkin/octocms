'use client';

import { signIn, useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { LogIn } from 'lucide-react';

import { useConfig } from '../../hooks/useConfig';
import { useTheme } from '../../admin/ThemeProvider';
import { cn } from '../../lib/utils';
import Header from '../../components/Header/Header';
import Loading from '../Loading';
import { Button } from '../ui/button';

type LayoutProps = {
  children: React.ReactNode;
};

const Layout = ({ children }: LayoutProps) => {
  const config = useConfig();
  const { data: session, status } = useSession();
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (status !== 'loading') {
      setIsInitialLoad(false);
    }
  }, [status]);

  // Show loading only on initial load, not during navigation
  if (status === 'loading' && isInitialLoad) {
    return <Loading message="Loading..." />;
  }

  return (
    <div className={cn('relative z-0 h-screen flex flex-col bg-background', resolvedTheme === 'dark' && 'dark')}>
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
          <Header title={`${config.projectName} CMS`} />
          <main className="relative z-0 flex-1 flex">{children}</main>
        </>
      )}
    </div>
  );
};

export default Layout;
