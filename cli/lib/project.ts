import { existsSync, readFileSync } from 'fs';
import { dirname, join, resolve } from 'path';

/**
 * Walk up from `startDir` until we find a directory containing a
 * `next.config.ts` that includes `withOctoCMS`.
 * Returns the absolute path to the project root.
 */
export function resolveProjectRoot(startDir?: string): string {
  let dir = startDir ?? process.cwd();
  for (;;) {
    const nextConfigPath = join(dir, 'next.config.ts');
    if (existsSync(nextConfigPath) && readFileSync(nextConfigPath, 'utf8').includes('withOctoCMS')) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error('Could not find next.config.ts with withOctoCMS — are you inside an OctoCMS project?');
    }
    dir = parent;
  }
}

/**
 * Load the CMS config from a project root. Uses `jiti` to handle TypeScript
 * files and tsconfig path aliases at runtime.
 */
export async function loadProjectConfig(projectRoot: string) {
  // Dynamic import so jiti stays an optional peer when published
  const { createJiti } = await import('jiti');
  // In this monorepo, octocms/ lives at the project root. When installed as an npm
  // package it lives in node_modules/octocms — jiti resolves it normally in that case.
  const alias: Record<string, string> = {};
  const localOctocms = resolve(projectRoot, 'octocms');
  if (existsSync(localOctocms)) {
    alias['octocms/'] = localOctocms + '/';
  }
  const jiti = createJiti(join(projectRoot, '__cli_loader__.ts'), {
    fsCache: false,
    moduleCache: false,
    alias,
  });
  const mod = (await jiti.import(join(projectRoot, 'cms', 'octocms.config.ts'), {
    default: true,
    try: true,
  })) as Record<string, unknown> | undefined;
  if (!mod || !mod.configOctoCMS) {
    throw new Error('cms/octocms.config.ts must export a `configOctoCMS` object (use defineConfig())');
  }
  return mod.configOctoCMS as import('../../types').Config;
}

/**
 * Load the COLLECTIONS array from `octocms/admin/consts.ts`.
 */
export async function loadCollections(projectRoot: string): Promise<readonly string[]> {
  const { createJiti } = await import('jiti');
  const alias: Record<string, string> = {};
  const localOctocms = resolve(projectRoot, 'octocms');
  if (existsSync(localOctocms)) {
    alias['octocms/'] = localOctocms + '/';
  }
  const jiti = createJiti(join(projectRoot, '__cli_loader__.ts'), {
    fsCache: false,
    moduleCache: false,
    alias,
  });
  const mod = (await jiti.import(join(projectRoot, 'octocms/admin/consts.ts'), {
    default: true,
    try: true,
  })) as Record<string, unknown> | undefined;
  if (!mod || !Array.isArray(mod.COLLECTIONS)) {
    throw new Error('Could not load COLLECTIONS from octocms/admin/consts.ts');
  }
  return mod.COLLECTIONS as readonly string[];
}

/**
 * Load FIELD_TYPES from `octocms/admin/consts.ts`.
 */
export async function loadFieldTypes(projectRoot: string): Promise<readonly string[]> {
  const { createJiti } = await import('jiti');
  const alias: Record<string, string> = {};
  const localOctocms = resolve(projectRoot, 'octocms');
  if (existsSync(localOctocms)) {
    alias['octocms/'] = localOctocms + '/';
  }
  const jiti = createJiti(join(projectRoot, '__cli_loader__.ts'), {
    fsCache: false,
    moduleCache: false,
    alias,
  });
  const mod = (await jiti.import(join(projectRoot, 'octocms/admin/consts.ts'), {
    default: true,
    try: true,
  })) as Record<string, unknown> | undefined;
  if (!mod || !Array.isArray(mod.FIELD_TYPES)) {
    throw new Error('Could not load FIELD_TYPES from octocms/admin/consts.ts');
  }
  return mod.FIELD_TYPES as readonly string[];
}
