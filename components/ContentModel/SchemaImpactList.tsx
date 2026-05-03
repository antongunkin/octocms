'use client';

/**
 * Render the entry-impact list returned by `previewSchemaChange`.
 *
 * Phase 6: each row is a clickable link to the entry editor (Linked-By style)
 * and shows a `Data preserved` / `Data loss` badge so users can see at a glance
 * which entries will lose content.
 */

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, ShieldCheck, ShieldAlert } from 'lucide-react';

import type { SchemaImpactItem } from '../../admin/actions/schema';
import { cn } from '../../lib/utils';

type Tone = 'amber' | 'destructive' | 'muted';

interface Props {
  items: readonly SchemaImpactItem[];
  /** Maximum entries to render before collapsing the rest into a `…and N more` line. */
  limit?: number;
  /** Title shown above the list (omit for headerless rendering). */
  title?: string;
  /** Visual tone of the surrounding card. */
  tone?: Tone;
  /** Override the default empty-state message. */
  emptyMessage?: string;
  /** Hide the link / show flat list (used when entries already point at the
   *  same dialog and clicking elsewhere would close the editor mid-flow). */
  asLinks?: boolean;
}

const TONE_CLASSES: Record<Tone, string> = {
  amber:
    'rounded-md border border-amber-900 bg-amber-950 p-3 text-xs text-amber-200 light:border-amber-200 light:bg-amber-50 light:text-amber-900',
  destructive: 'rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive',
  muted: 'rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground',
};

export default function SchemaImpactList({
  items,
  limit = 30,
  title,
  tone = 'amber',
  emptyMessage,
  asLinks = true,
}: Props) {
  if (items.length === 0) {
    if (!emptyMessage) return null;
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }
  const visible = items.slice(0, limit);
  const overflow = Math.max(items.length - limit, 0);

  return (
    <div className={TONE_CLASSES[tone]}>
      {title ? (
        <div className="mb-1.5 flex items-center gap-1.5 font-medium">
          <AlertTriangle className="h-3.5 w-3.5" />
          {title}
        </div>
      ) : null}
      <ul className="max-h-44 space-y-1 overflow-auto">
        {visible.map((it) => (
          <ImpactRow key={it.path} item={it} asLink={asLinks} />
        ))}
        {overflow > 0 ? <li className="pl-2 italic">…and {overflow} more.</li> : null}
      </ul>
    </div>
  );
}

function ImpactRow({ item, asLink }: { item: SchemaImpactItem; asLink: boolean }) {
  const inner = (
    <span className="flex items-center justify-between gap-2 px-2 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{item.title}</span>
        <span className="block truncate text-[11px] opacity-80">
          <code className="font-mono">{item.type}</code> · {item.reasons.join('; ')}
        </span>
        {item.warnings.length > 0 ? (
          <span className="mt-0.5 block truncate text-[11px] font-medium">⚠ {item.warnings.join('; ')}</span>
        ) : null}
      </span>
      <DataLossBadge dataLoss={item.dataLoss} />
      {asLink ? <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-50" /> : null}
    </span>
  );

  // /cms/content/<type>/<id> matches the existing entry-editor route.
  const href = `/cms/content/${item.type}/${item.id}`;

  return (
    <li>
      {asLink ? (
        <Link
          href={href}
          target="_blank"
          rel="noreferrer"
          className={cn(
            'block rounded transition hover:bg-background/50',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
          )}
        >
          {inner}
        </Link>
      ) : (
        inner
      )}
    </li>
  );
}

function DataLossBadge({ dataLoss }: { dataLoss: boolean }) {
  if (dataLoss) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive">
        <ShieldAlert className="h-3 w-3" />
        Data loss
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded border border-emerald-900 bg-emerald-950 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-300 light:border-emerald-300 light:bg-emerald-50 light:text-emerald-700">
      <ShieldCheck className="h-3 w-3" />
      Preserved
    </span>
  );
}
