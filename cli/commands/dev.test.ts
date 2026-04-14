import { mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const TMP_DIR = join(process.cwd(), '.tmp-dev-test');

beforeEach(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
  process.exitCode = undefined;
});

describe('dev command preconditions', () => {
  it('requires next.config.ts to exist', async () => {
    const { devCommand } = await import('./dev');
    await devCommand(TMP_DIR, { port: 3001 });
    expect(process.exitCode).toBe(1);
  });

  it('accepts custom port option', () => {
    const options: import('./dev').DevOptions = { port: 4000 };
    expect(options.port).toBe(4000);
  });
});
