/**
 * Canonical URL paths for OctoCMS Route Handlers scaffolded under `/api/octocms/*`.
 * Client components and hooks import these constants so path changes stay centralized.
 */
export const OCTOCMS_API = {
  auth: {
    login: '/api/octocms/auth/login',
    callback: '/api/octocms/auth/callback',
    logout: '/api/octocms/auth/logout',
    session: '/api/octocms/auth/session',
    devBypass: '/api/octocms/auth/dev-bypass',
  },
  agent: '/api/octocms/agent',
  search: '/api/octocms/search',
} as const;
