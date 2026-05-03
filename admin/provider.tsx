'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import React from 'react';

import type { Config } from '../types';
import { ConfigProvider } from '../hooks/useConfig';

export default function Provider({
  children,
  session,
  config,
}: {
  children: React.ReactNode;
  session?: Session | null;
  config: Config;
}): React.ReactNode {
  return (
    <SessionProvider session={session}>
      <ConfigProvider config={config}>{children}</ConfigProvider>
    </SessionProvider>
  );
}
