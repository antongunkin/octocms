/* oxlint-disable no-console -- intentional server-side observability for CMS/GitHub actions */

type CmsServerLogFields = {
  operation: string;
  message: string;
  branch?: string;
  status?: number;
};

/**
 * Structured stderr logging for CMS server actions (GitHub API failures, etc.).
 * Kept in one module so `no-console` stays enabled elsewhere.
 */
export const logCmsServerError = (fields: CmsServerLogFields): void => {
  const parts = [
    '[cms]',
    fields.operation,
    fields.branch ? `branch=${fields.branch}` : null,
    fields.status != null ? `status=${fields.status}` : null,
    fields.message,
  ].filter(Boolean);
  console.error(parts.join(' '));
};
