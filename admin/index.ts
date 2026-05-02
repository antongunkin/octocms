/**
 * Public admin barrel — the npm-style entry point that user apps import from.
 *
 * Wired in `src/app/cms/[[...path]]/page.tsx` (catch-all default export),
 * `src/app/cms/layout.tsx` (default export + metadata), and
 * `src/app/cms/error.tsx` (default export). The CLI scaffolds those three
 * thin re-export files; everything else lives inside the package.
 */
export { AdminApp } from './AdminApp';
export { AdminLayout, metadata } from './pages/AdminLayout';
export { AdminError, AdminErrorView } from './pages/AdminErrorView';
export type { AdminErrorViewProps } from './pages/AdminErrorView';
