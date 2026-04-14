'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import React from 'react';

import type { Config } from '../types';
import { ConfigProvider } from '../hooks/useConfig';
import { ThemeProvider } from './ThemeProvider';
import type { Theme } from './theme';

export default function Provider({
  children,
  session,
  initialTheme,
  config,
}: {
  children: React.ReactNode;
  session?: Session | null;
  initialTheme: Theme;
  config: Config;
}): React.ReactNode {
  return (
    <SessionProvider session={session}>
      <ConfigProvider config={config}>
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </ConfigProvider>
    </SessionProvider>
  );
}
