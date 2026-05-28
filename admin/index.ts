/**
 * Server-safe admin barrel — the npm-style entry point that user apps import from.
 *
 * Wired in `src/app/cms/[[...path]]/page.tsx` (catch-all default export) and
 * `src/app/cms/layout.tsx` (default export + metadata). For the client
 * `error.tsx` boundary, import from `octocms/admin/error` instead.
 */
export { AdminApp } from './AdminApp';
export { AdminLayout, metadata } from './pages/AdminLayout';
