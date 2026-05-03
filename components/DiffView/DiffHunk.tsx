'use client';

import React, { useMemo } from 'react';
import { diffLines } from 'diff';

import { cn } from '../../lib/utils';

type DiffHunkProps = {
  before: string;
  after: string;
  /** Show line numbers in the gutter. Useful for markdown/richtext; off by default for short fields. */
  showLineNumbers?: boolean;
  /** Extra className for the outer container. */
  className?: string;
};

type RenderedLine = {
  kind: 'add' | 'del' | 'ctx';
  text: string;
  beforeNum: number | null;
  afterNum: number | null;
};

/**
 * Renders a unified +/- diff view between two strings. WCAG-AA contrast, monospace.
 * Used by DiffView for every text-like field: string, text, markdown, richtext, json, etc.
 */
export function DiffHunk({ before, after, showLineNumbers = false, className }: DiffHunkProps) {
  const lines = useMemo(() => buildLines(before, after), [before, after]);

  if (lines.length === 0) {
    return (
      <div
        className={cn('rounded-md border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground', className)}
      >
        No content
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-md border border-border bg-card overflow-hidden font-mono text-[12.5px] leading-[1.55]',
        className,
      )}
    >
      {lines.map((ln, i) => (
        <div
          key={i}
          className={cn(
            'flex whitespace-pre-wrap',
            ln.kind === 'add' && 'bg-emerald-950/40 text-emerald-200 light:bg-emerald-50 light:text-emerald-900',
            ln.kind === 'del' && 'bg-red-950/40 text-red-200 light:bg-red-50 light:text-red-900',
            ln.kind === 'ctx' && 'text-muted-foreground',
          )}
        >
          {showLineNumbers && (
            <>
              <span className="select-none w-9 shrink-0 px-1 text-right text-[11px] text-muted-foreground/70 border-r border-border/60 py-0.5">
                {ln.beforeNum ?? ''}
              </span>
              <span className="select-none w-9 shrink-0 px-1 text-right text-[11px] text-muted-foreground/70 border-r border-border/60 py-0.5">
                {ln.afterNum ?? ''}
              </span>
            </>
          )}
          <span className="select-none w-6 shrink-0 text-center py-0.5">
            {ln.kind === 'add' ? '+' : ln.kind === 'del' ? '−' : ' '}
          </span>
          <span className="flex-1 px-2 py-0.5 break-words">{ln.text === '' ? '\u00a0' : ln.text}</span>
        </div>
      ))}
    </div>
  );
}

function buildLines(before: string, after: string): RenderedLine[] {
  if (before === after) {
    // Single-line context render — caller usually won't invoke this, but handle gracefully.
    return before.split('\n').map((t, i) => ({
      kind: 'ctx' as const,
      text: t,
      beforeNum: i + 1,
      afterNum: i + 1,
    }));
  }

  const parts = diffLines(before, after, { newlineIsToken: false });
  const out: RenderedLine[] = [];
  let beforeLine = 1;
  let afterLine = 1;

  for (const part of parts) {
    // Split the chunk into lines, dropping the trailing empty element produced by a terminal "\n".
    const rawLines = part.value.split('\n');
    if (rawLines.length > 0 && rawLines[rawLines.length - 1] === '') {
      rawLines.pop();
    }

    if (part.added) {
      for (const text of rawLines) {
        out.push({ kind: 'add', text, beforeNum: null, afterNum: afterLine });
        afterLine++;
      }
    } else if (part.removed) {
      for (const text of rawLines) {
        out.push({ kind: 'del', text, beforeNum: beforeLine, afterNum: null });
        beforeLine++;
      }
    } else {
      for (const text of rawLines) {
        out.push({ kind: 'ctx', text, beforeNum: beforeLine, afterNum: afterLine });
        beforeLine++;
        afterLine++;
      }
    }
  }

  return out;
}
