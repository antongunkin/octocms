import type { NextConfig } from 'next';
import type { Config } from './types';
import { assertProductionEnvOrThrow } from './lib/deploymentEnv';

export function withOctoCMS(nextConfig: NextConfig = {}, _octoConfig: Config): NextConfig {
  if (process.env.NODE_ENV === 'production') {
    assertProductionEnvOrThrow();
  }

  return {
    ...nextConfig,
  };
}
