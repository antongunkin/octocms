'use client';

import React, { createContext, useContext } from 'react';
import type { Config } from '../types';
import { setConfig } from '../lib/configStore';

const ConfigContext = createContext<Config | null>(null);

/**
 * Provides the CMS config to all admin client components.
 * Also calls `setConfig()` so the module-level singleton is available
 * in the client bundle for any non-component code that needs it.
 */
export function ConfigProvider({ config, children }: { config: Config; children: React.ReactNode }) {
  // Populate the singleton for non-React code running in the same bundle.
  setConfig(config);

  return <ConfigContext value={config}>{children}</ConfigContext>;
}

/**
 * Read the CMS config from React context. Must be called inside a
 * `<ConfigProvider>` (which is set up automatically by `AdminLayout`).
 */
export function useConfig(): Config {
  const config = useContext(ConfigContext);
  if (!config) {
    throw new Error('useConfig() must be used within a <ConfigProvider>. Wrap your admin layout with ConfigProvider.');
  }
  return config;
}
