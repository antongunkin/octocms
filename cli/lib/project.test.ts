import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolveProjectRoot } from './project';

const TMP_DIR = join(process.cwd(), '.tmp-project-test');

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('resolveProjectRoot', () => {
  it('finds project root with next.config.ts containing withOctoCMS', () => {
    writeFileSync(join(TMP_DIR, 'next.config.ts'), 'export default withOctoCMS(nextConfig, config);', 'utf8');
    const root = resolveProjectRoot(TMP_DIR);
    expect(root).toBe(TMP_DIR);
  });

  it('walks up directories to find config', () => {
    writeFileSync(join(TMP_DIR, 'next.config.ts'), 'export default withOctoCMS(nextConfig, config);', 'utf8');
    const nested = join(TMP_DIR, 'a', 'b', 'c');
    mkdirSync(nested, { recursive: true });
    const root = resolveProjectRoot(nested);
    expect(root).toBe(TMP_DIR);
  });

  it('throws when no config found', () => {
    // Use a path that won't walk up into this project's next.config.ts
    expect(() => resolveProjectRoot('/tmp/nonexistent-octocms-test-path')).toThrow(
      'Could not find next.config.ts with withOctoCMS',
    );
  });
});
