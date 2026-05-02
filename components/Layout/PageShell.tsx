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
import { PageBar, type PageBarProps } from './PageBar';

type PageShellRootProps = {
  className?: string;
  children: React.ReactNode;
};

function PageShellRoot({ className, children }: PageShellRootProps) {
  return <div className={cn('flex min-h-0 flex-1 flex-col', className)}>{children}</div>;
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
    <main className={cn('scroll min-h-0 flex-1 overflow-auto bg-[var(--bg)]', !unpadded && 'px-6 py-6', className)}>
      {centered ? <div className="mx-auto w-full max-w-[1280px]">{children}</div> : children}
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
      className={cn('grid min-h-0 flex-1 overflow-hidden bg-[var(--bg)]', className)}
      style={{ gridTemplateColumns: `minmax(0, 1fr) ${asideWidth}px` }}
    >
      <div className="scroll min-w-0 overflow-auto px-7 py-6 pb-14">{children}</div>
      <aside className="scroll min-w-0 overflow-auto border-l border-[var(--border)] bg-[var(--surface-2)] px-4 py-5">
        {aside}
      </aside>
    </main>
  );
}

export const PageShell = Object.assign(PageShellRoot, {
  Bar: PageBar,
  Body: PageShellBody,
  Split: PageShellSplit,
});

export type { PageBarProps };
