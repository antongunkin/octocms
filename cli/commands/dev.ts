/**
 * `octocms dev` — Start Next.js dev server with next.config.ts watching.
 *
 * Spawns `next dev` and watches the config file for changes. When the
 * config changes, types are automatically regenerated.
 */

import { spawn } from 'child_process';
import { existsSync, watch } from 'fs';
import { join } from 'path';

import { log } from '../lib/logger';

export type DevOptions = {
  port?: number;
};

export async function devCommand(projectRoot: string, options: DevOptions = {}): Promise<void> {
  const port = options.port ?? 3000;

  log.header('Development server');

  const nextConfigPath = join(projectRoot, 'next.config.ts');
  const octoConfigPath = join(projectRoot, 'cms', 'octocms.config.ts');
  if (!existsSync(nextConfigPath)) {
    log.error('next.config.ts not found — run `octocms init` first.');
    process.exitCode = 1;
    return;
  }

  log.info(`Starting Next.js dev server on port ${port}...`);
  log.info('Watching next.config.ts and cms/octocms.config.ts for changes...');
  log.blank();

  // Spawn next dev
  const nextBin = join(projectRoot, 'node_modules', '.bin', 'next');
  const child = spawn(nextBin, ['dev', '-p', String(port)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: { ...process.env },
  });

  // Watch both config files for changes and regenerate types
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const onConfigChange = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      regenerateTypes(projectRoot);
    }, 300);
  };

  const nextWatcher = watch(nextConfigPath, onConfigChange);
  const octoWatcher = existsSync(octoConfigPath) ? watch(octoConfigPath, onConfigChange) : null;

  // Forward signals to child
  const cleanup = () => {
    nextWatcher.close();
    octoWatcher?.close();
    if (debounceTimer) clearTimeout(debounceTimer);
    child.kill();
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  child.on('exit', (code) => {
    nextWatcher.close();
    octoWatcher?.close();
    if (debounceTimer) clearTimeout(debounceTimer);
    process.exitCode = code ?? 0;
  });
}

function regenerateTypes(projectRoot: string): void {
  log.blank();
  log.step('Config changed — regenerating types...');

  const jitiBin = join(projectRoot, 'node_modules', '.bin', 'jiti');
  const scriptPath = join(projectRoot, 'scripts', 'generate-types.ts');

  const child = spawn(jitiBin, [scriptPath], {
    cwd: projectRoot,
    stdio: 'pipe',
  });

  let stderr = '';
  child.stderr?.on('data', (data: Buffer) => {
    stderr += data.toString();
  });

  child.on('exit', (code) => {
    if (code === 0) {
      log.success('Types regenerated');
    } else {
      log.error('Type generation failed:');
      if (stderr.trim()) {
        for (const line of stderr.trim().split('\n')) {
          log.info(`  ${line}`);
        }
      }
    }
    log.blank();
  });
}
