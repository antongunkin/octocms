import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * `@tanstack/react-query-devtools` is intentionally not loaded by the
 * package, and not used by the OctoCMS dev repo either. Multiple patterns
 * were attempted:
 *
 *  - Static `import { ReactQueryDevtools } from '@tanstack/react-query-devtools'`
 *    requires consumers to install the dep or the build fails.
 *  - Dynamic `import('@tanstack/react-query-devtools')` with a literal
 *    specifier — bundlers statically resolve and fail on missing dep, even
 *    with `peerDependenciesMeta.optional`.
 *  - Dynamic import via variable specifier + `webpackIgnore` /
 *    `turbopackIgnore` magic comments — bundlers leave the import alone, but
 *    then the browser cannot resolve the bare specifier at runtime.
 *  - `new Function('m', 'return import(m)')` — same browser-resolution
 *    failure as magic comments.
 *  - Mounting `<ReactQueryDevtools />` from a dev-repo wrapper inside
 *    `<AdminLayout>` — works in principle but Turbopack's chunking creates
 *    duplicate `QueryClientContext` instances between the package's
 *    `QueryProvider` and the consumer-side `react-query-devtools`, so
 *    `useQueryClient()` throws "No QueryClient set".
 *
 * Use the React DevTools browser extension's React Query inspector or the
 * standalone Chrome extension if you need query introspection during dev.
 */
describe('QueryProvider — devtools NOT loaded by the package', () => {
  const source = readFileSync(join(__dirname, 'QueryProvider.tsx'), 'utf8');

  it('does not import @tanstack/react-query-devtools (static or dynamic)', () => {
    expect(source).not.toMatch(/from\s+['"]@tanstack\/react-query-devtools['"]/);
    expect(source).not.toMatch(/import\(\s*[^)]*['"]@tanstack\/react-query-devtools['"]/);
    expect(source).not.toMatch(/=\s*['"]@tanstack\/react-query-devtools['"]/);
  });

  it('still mounts a real QueryClientProvider so the admin client cache works', () => {
    expect(source).toMatch(/<QueryClientProvider/);
  });
});

describe('package.json — devtools is not declared anywhere', () => {
  const pkgPath = join(__dirname, '..', '..', 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  it('absent from peerDependencies', () => {
    expect(pkg.peerDependencies?.['@tanstack/react-query-devtools']).toBeUndefined();
    expect(pkg.peerDependenciesMeta?.['@tanstack/react-query-devtools']).toBeUndefined();
  });

  it('absent from dependencies', () => {
    expect(pkg.dependencies?.['@tanstack/react-query-devtools']).toBeUndefined();
  });

  it('absent from devDependencies', () => {
    expect(pkg.devDependencies?.['@tanstack/react-query-devtools']).toBeUndefined();
  });
});
