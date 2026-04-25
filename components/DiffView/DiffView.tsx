'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useConfig } from '../../hooks/useConfig';
import { stringifyFieldValue, type FieldDiff } from '../../lib/entryDiff';
import type { CollectionField } from '../../types';
import { cn } from '../../lib/utils';
import type { EntryDiff } from '../../admin/actions/diff';
import { DiffHunk } from './DiffHunk';

type DiffViewProps = {
  collectionType: string;
  entryPath: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

const LINE_NUMBERED_FORMATS = new Set(['markdown', 'richtext', 'text', 'json']);

export function DiffView({ collectionType, entryPath }: DiffViewProps) {
  const config = useConfig();
  const [diff, setDiff] = useState<EntryDiff | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const statusRef = useRef<Status>('idle');
  statusRef.current = status;

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    (async () => {
      try {
        const { getEntryDiff } = await import('../../admin/actions');
        const result = await getEntryDiff(entryPath);
        if (!cancelled) {
          setDiff(result);
          setStatus('ready');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [entryPath]);

  const collection = (config.collections as Record<string, { label: string; fields: Record<string, CollectionField> }>)[
    collectionType
  ];

  const fieldList = useMemo(() => {
    if (!collection) return [] as Array<[string, CollectionField]>;
    return Object.entries(collection.fields);
  }, [collection]);

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="space-y-3">
        <div className="h-6 w-64 rounded bg-muted/40" />
        <div className="h-24 rounded bg-muted/30" />
        <div className="h-24 rounded bg-muted/30" />
      </div>
    );
  }

  if (status === 'error' || !diff) {
    return <p className="text-sm text-muted-foreground">Could not load diff.</p>;
  }

  if (!diff.changed) {
    return (
      <div className="rounded-md border border-border bg-card p-8 text-center">
        <p className="text-sm font-medium text-foreground">No unmerged changes for this entry</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Active branch <code className="font-mono">{diff.activeBranch || '—'}</code> matches{' '}
          <code className="font-mono">{diff.baseBranch}</code> for this file.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Comparing</span>
        <code className="font-mono rounded bg-muted px-1.5 py-0.5 text-foreground">{diff.activeBranch}</code>
        <span>→</span>
        <code className="font-mono rounded bg-muted px-1.5 py-0.5 text-foreground">{diff.baseBranch}</code>
      </div>
      {fieldList.map(([name, fieldDef]) => (
        <FieldDiffRow
          key={name}
          name={name}
          fieldDef={fieldDef}
          fieldDiff={diff.fields[name]}
          companion={diff.companions[name]}
          imageUrls={diff.imageUrls}
        />
      ))}
    </div>
  );
}

type FieldDiffRowProps = {
  name: string;
  fieldDef: CollectionField;
  fieldDiff: FieldDiff | undefined;
  companion: { before: string | null; after: string | null } | undefined;
  imageUrls: Record<string, string>;
};

function FieldDiffRow({ name, fieldDef, fieldDiff, companion, imageUrls }: FieldDiffRowProps) {
  const format = fieldDef.format;
  const usesCompanion = format === 'markdown' || format === 'richtext';

  const before = usesCompanion
    ? (companion?.before ?? '')
    : stringifyFieldValue(fieldDiff?.kind === 'added' ? '' : getBefore(fieldDiff));
  const after = usesCompanion
    ? (companion?.after ?? '')
    : stringifyFieldValue(fieldDiff?.kind === 'removed' ? '' : getAfter(fieldDiff));

  const isUnchanged = usesCompanion ? before === after : !fieldDiff || fieldDiff.kind === 'unchanged';

  return (
    <section className="rounded-md border border-border bg-card overflow-hidden">
      <header className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2">
        <label className="text-[13.5px] font-semibold text-foreground">{fieldDef.label}</label>
        <code className="font-mono text-[11px] text-muted-foreground">{format}</code>
        {!isUnchanged && (
          <span title="Unpublished change" className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Changed" />
        )}
        <div className="flex-1" />
        <span className="text-[11px] text-muted-foreground">{name}</span>
      </header>

      <div className="p-3">
        {isUnchanged ? (
          <p className="text-xs text-muted-foreground">No changes</p>
        ) : format === 'image' ? (
          <ImageDiff fieldDiff={fieldDiff} imageUrls={imageUrls} />
        ) : (
          <DiffHunk before={before} after={after} showLineNumbers={LINE_NUMBERED_FORMATS.has(format)} />
        )}
      </div>
    </section>
  );
}

function getBefore(d: FieldDiff | undefined): unknown {
  if (!d) return '';
  if (d.kind === 'changed' || d.kind === 'removed') return d.before;
  return '';
}

function getAfter(d: FieldDiff | undefined): unknown {
  if (!d) return '';
  if (d.kind === 'changed' || d.kind === 'added') return d.after;
  return '';
}

function ImageDiff({ fieldDiff, imageUrls }: { fieldDiff: FieldDiff | undefined; imageUrls: Record<string, string> }) {
  const beforeUuid = typeof getBefore(fieldDiff) === 'string' ? (getBefore(fieldDiff) as string) : '';
  const afterUuid = typeof getAfter(fieldDiff) === 'string' ? (getAfter(fieldDiff) as string) : '';

  const beforeUrl = beforeUuid ? (imageUrls[beforeUuid] ?? '') : '';
  const afterUrl = afterUuid ? (imageUrls[afterUuid] ?? '') : '';

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <ImageSide label="Was" uuid={beforeUuid} url={beforeUrl} tone="del" />
      <ImageSide label="Now" uuid={afterUuid} url={afterUrl} tone="add" />
    </div>
  );
}

function ImageSide({ label, uuid, url, tone }: { label: string; uuid: string; url: string; tone: 'add' | 'del' }) {
  return (
    <div
      className={cn(
        'rounded-md border p-2',
        tone === 'add'
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30'
          : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold',
            tone === 'add'
              ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200'
              : 'bg-red-100 text-red-900 dark:bg-red-900/50 dark:text-red-200',
          )}
        >
          {label}
        </span>
        <code className="font-mono text-[11px] text-muted-foreground truncate">{uuid || '—'}</code>
      </div>
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={label} className="w-full h-auto rounded border border-border bg-background" />
      ) : (
        <div className="flex h-32 items-center justify-center rounded border border-dashed border-border bg-background text-xs text-muted-foreground">
          {uuid ? 'No preview' : 'None'}
        </div>
      )}
    </div>
  );
}
