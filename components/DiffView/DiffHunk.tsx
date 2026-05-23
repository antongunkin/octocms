'use client';

import React, { useMemo } from 'react';
import { diffLines } from 'diff';

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
      <div className={`octo-diff-hunk__lines octo-diff-hunk__lines--empty${className ? ` ${className}` : ''}`}>
        No content
      </div>
    );
  }

  return (
    <div className={`octo-diff-hunk__lines${className ? ` ${className}` : ''}`}>
      {lines.map((ln, i) => (
        <div key={i} className={`octo-diff-hunk__line octo-diff-hunk__line--${ln.kind}`}>
          {showLineNumbers && (
            <>
              <span className="octo-diff-hunk__line-num">{ln.beforeNum ?? ''}</span>
              <span className="octo-diff-hunk__line-num">{ln.afterNum ?? ''}</span>
            </>
          )}
          <span className="octo-diff-hunk__line-sign">{ln.kind === 'add' ? '+' : ln.kind === 'del' ? '−' : ' '}</span>
          <span className="octo-diff-hunk__line-text">{ln.text === '' ? ' ' : ln.text}</span>
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
