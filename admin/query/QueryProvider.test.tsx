import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * `@tanstack/react-query-devtools` is loaded best-effort in development:
 *
 *  - If the dep is installed in the consumer's project → devtools panel mounts.
 *  - If absent → silently skipped, no error.
 *  - In production → the loader is never called.
 *
 * For consumer-build safety, the import MUST be opaque to bundlers (no
 * static specifier they can trace). We use the `Function` constructor —
 * Webpack / Turbopack / Rspack physically cannot follow it. This test
 * guards the pattern.
 */
describe('QueryProvider — devtools loaded via bundler-opaque dynamic import', () => {
  const source = readFileSync(join(__dirname, 'QueryProvider.tsx'), 'utf8');

  it('does NOT use a static import or specifier-literal dynamic import (would break consumer builds)', () => {
    // Static `from '...'`: would force the consumer to install the dep.
    expect(source).not.toMatch(/from\s+['"]@tanstack\/react-query-devtools['"]/);
    // Bare `import('...')` literal: bundlers statically resolve and fail on missing dep
    // even with magic comments in some configurations.
    expect(source).not.toMatch(/import\(\s*['"]@tanstack\/react-query-devtools['"]\s*\)/);
  });

  it('loads via the Function constructor so bundlers cannot trace the specifier', () => {
    expect(source).toMatch(/new Function\([^)]*['"]return import\(m\)['"]/);
    // The actual specifier is passed as a runtime string, not a literal in the import call.
    expect(source).toMatch(/['"]@tanstack\/react-query-devtools['"]/);
  });

  it('catches both Function-constructor failures (CSP) and dynamic-import failures (missing dep)', () => {
    // CSP path: try/catch around `new Function(...)`.
    expect(source).toMatch(/try\s*\{[\s\S]*?new Function/);
    // Missing-dep path: `.catch` on the dynamic import.
    expect(source).toMatch(/\.catch\(/);
  });

  it('only attempts to load in development', () => {
    expect(source).toMatch(/process\.env\.NODE_ENV\s*===\s*['"]production['"]/);
  });

  it('still mounts a real QueryClientProvider so the admin client cache works', () => {
    expect(source).toMatch(/<QueryClientProvider/);
  });
});

describe('package.json — devtools is NOT a peer dependency (consumer-optional)', () => {
  const pkgPath = join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  it('devtools is absent from peerDependencies (loaded via Function-constructor import)', () => {
    expect(pkg.peerDependencies?.['@tanstack/react-query-devtools']).toBeUndefined();
    expect(pkg.peerDependenciesMeta?.['@tanstack/react-query-devtools']).toBeUndefined();
  });

  it('devtools IS a devDependency (so the OctoCMS dev repo gets the panel)', () => {
    expect(pkg.devDependencies?.['@tanstack/react-query-devtools']).toBeDefined();
  });
});
