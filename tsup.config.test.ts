import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * Regression guard: `cli/lib/codegen.ts` and `cli/lib/validateConfig.ts` are
 * imported at runtime by `admin/actions/schema.ts` (`../../cli/lib/...`). If
 * tsup.config.ts ever excludes `cli/lib/**` again, the dist ships only `.d.ts`
 * files and the admin route handler crashes at request time with
 * "Cannot find module '../../cli/lib/codegen'".
 *
 * We assert against the source text (not by importing the config — tsup
 * pulls in esbuild via bundle-require which doesn't run under vitest).
 */
describe('tsup config — runtime cli/lib emission', () => {
  const source = readFileSync(join(__dirname, 'tsup.config.ts'), 'utf8');

  it("includes 'cli/lib' in the SOURCE_DIRS list so its files are picked up", () => {
    expect(source).toContain("'cli/lib'");
  });

  it('excludes the bundled CLI entry (cli/index.ts) via IGNORE_FILES', () => {
    expect(source).toContain("'cli/index.ts'");
  });

  it('excludes cli/commands/** from runtime entries (CLI-only, bundled into cli/index)', () => {
    // cli/commands is not in SOURCE_DIRS, so it is never scanned for runtime entries
    expect(source).not.toMatch(/'cli\/commands'/);
  });

  it('filters out test files in listSourceFiles', () => {
    expect(source).toContain('.test.ts');
    expect(source).toContain('.test.tsx');
  });
});
