import type { NextConfig } from 'next';
import type { Config } from './types';
import { assertProductionEnvOrThrow } from './lib/deploymentEnv';
import { setConfig } from './lib/configStore';

export function withOctoCMS(nextConfig: NextConfig = {}, octoConfig: Config): NextConfig {
  setConfig(octoConfig);

  if (process.env.NODE_ENV === 'production') {
    assertProductionEnvOrThrow();
  }

  return {
    ...nextConfig,
  };
}
