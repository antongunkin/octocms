// PageShell — composition wrapper for admin pages in the v2 redesign.
//
// The TopHeader is mounted once at the layout level (in `Layout.tsx`), so
// PageShell only owns the per-page region: an optional PageBar plus the
// scrollable main column. Two body modes:
//   <PageShell.Body>      — single column, max-width centered
//   <PageShell.Split aside={...}> — main + sticky right aside (entry editor)
//
// Pages start adopting this in Phase 3+. Phase 2 just exports the primitive.
'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';
import { PageBar } from './PageBar';

type PageShellRootProps = {
  className?: string;
  children: React.ReactNode;
};

function PageShellRoot({ className, children }: PageShellRootProps) {
  return <div className={cn('octo-page-shell', className)}>{children}</div>;
}

type PageShellBodyProps = {
  className?: string;
  /** When true, drop the default px-6 py-6 padding (e.g. for full-bleed media grids). */
  unpadded?: boolean;
  /** When true, cap content width at 1280px and center. */
  centered?: boolean;
  children: React.ReactNode;
};

function PageShellBody({ className, unpadded, centered, children }: PageShellBodyProps) {
  return (
    <main
      className={cn(
        'octo-page-shell__body octo-scroll',
        unpadded && 'octo-page-shell__body octo-page-shell__body--unpadded',
        className,
      )}
    >
      {centered ? <div className="octo-page-shell__centered">{children}</div> : children}
    </main>
  );
}

type PageShellSplitProps = {
  className?: string;
  asideWidth?: number;
  aside: React.ReactNode;
  children: React.ReactNode;
};

function PageShellSplit({ className, asideWidth = 280, aside, children }: PageShellSplitProps) {
  return (
    <main
      className={cn('octo-page-shell__split', className)}
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${asideWidth}px` }}
    >
      <div className="octo-page-shell__split-content octo-scroll">{children}</div>
      <aside className="octo-page-shell__split-aside octo-scroll">{aside}</aside>
    </main>
  );
}

export const PageShell = Object.assign(PageShellRoot, {
  Bar: PageBar,
  Body: PageShellBody,
  Split: PageShellSplit,
});
