'use client';

import React from 'react';

import type { Config } from '../types';
import { ConfigProvider } from '../hooks/useConfig';

import { QueryProvider } from './query/QueryProvider';

export default function Provider({ children, config }: { children: React.ReactNode; config: Config }): React.ReactNode {
  return (
    <ConfigProvider config={config}>
      <QueryProvider>{children}</QueryProvider>
    </ConfigProvider>
  );
}
