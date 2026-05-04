import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard: `cli/lib/codegen.ts` and `cli/lib/validateConfig.ts` are
 * imported at runtime by `admin/actions/schema.ts` (`../../cli/lib/...`). If
 * the glob in `tsup.config.ts` ever excludes `cli/lib/**` again, the dist
 * ships only `.d.ts` files and the admin route handler crashes at request
 * time with "Cannot find module '../../cli/lib/codegen'".
 *
 * We assert against the source text (not by importing the config — tsup
 * pulls in esbuild via bundle-require which doesn't run under vitest).
 */
describe('tsup config — runtime cli/lib emission', () => {
  const source = readFileSync(join(__dirname, 'tsup.config.ts'), 'utf8');

  it('includes cli/lib/**/*.{ts,tsx} in the runtime entry glob', () => {
    expect(source).toContain("'cli/lib/**/*.{ts,tsx}'");
  });

  it('excludes the bundled CLI entry (cli/index.ts) from the runtime entries', () => {
    // The CLI is built as a separate bundled entry below; including it here
    // would emit a second copy.
    expect(source).toMatch(/ignore:\s*\[[^\]]*'cli\/index\.ts'/);
  });

  it('excludes cli/commands/** from runtime entries (CLI-only, bundled into cli/index)', () => {
    expect(source).toMatch(/ignore:\s*\[[^\]]*'cli\/commands\/\*\*'/);
  });

  it('still excludes test files', () => {
    expect(source).toMatch(/ignore:\s*\[[^\]]*'\*\*\/\*\.test\.\{ts,tsx\}'/);
  });
});
