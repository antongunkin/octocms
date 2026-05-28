/**
 * Client-safe admin error entry — import from here in `app/cms/error.tsx`.
 *
 * Do not import from `octocms/admin` in client components: that barrel also
 * re-exports `AdminApp`, which pulls server-only auth helpers (`next/headers`).
 */
export { AdminError, AdminErrorView } from './pages/AdminErrorView';
export type { AdminErrorViewProps } from './pages/AdminErrorView';
