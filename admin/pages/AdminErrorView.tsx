'use client';

import React from 'react';

import { Button } from '../../components/ui/button';
import { isContentSourceError, parseContentSourceFromMessage } from '../../lib/contentSourceError';

/**
 * Drop-in `error.tsx` body for the admin catch-all. Receives Next.js's
 * standard `{ error, reset }` props and renders the shared `AdminErrorView`.
 *
 * Wired into the user app via a one-line re-export:
 *   `export { AdminError as default } from 'octocms/admin'`
 */
export function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <AdminErrorView error={error} reset={reset} />;
}

export type AdminErrorViewProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Section title shown above the message. Defaults to "Something went wrong". */
  title?: string;
  /** Optional href for the secondary "Back" button. Defaults to /cms. */
  backHref?: string;
  /** Optional label for the secondary button. Defaults to "Dashboard". */
  backLabel?: string;
};

/**
 * Shared admin error view used by every per-segment `error.tsx` file under
 * `src/app/cms/`. Reuses the GitHub-aware copy logic from the existing root
 * error boundary in `src/app/error.tsx`, but inside the admin chrome.
 */
export function AdminErrorView({
  error,
  reset,
  title = 'Something went wrong',
  backHref = '/cms',
  backLabel = 'Dashboard',
}: AdminErrorViewProps) {
  const fromInstance = isContentSourceError(error) ? { userMessage: error.userMessage, code: error.code } : null;
  const fromMessage = parseContentSourceFromMessage(error.message);
  const userMessage = fromInstance?.userMessage ?? fromMessage?.userMessage;
  const code = fromInstance?.code ?? fromMessage?.code;
  const isAvailability = code === 'github_unavailable' || code === 'github_rate_limit';

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/20 p-6">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 shadow-sm">
        <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
        {userMessage ? (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{userMessage}</p>
        ) : (
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            An unexpected error occurred while loading this page.
          </p>
        )}
        {isAvailability ? (
          <p className="mt-1 text-xs text-muted-foreground">You can try again in a few minutes.</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => reset()}>
            Try again
          </Button>
          <Button type="button" size="sm" variant="outline" asChild>
            <a href={backHref}>{backLabel}</a>
          </Button>
        </div>
        {error.digest ? (
          <p className="mt-6 text-[11px] uppercase tracking-wide text-muted-foreground">Reference: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
