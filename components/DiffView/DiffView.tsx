'use client';

import React, { useMemo } from 'react';

import { useEntryDiff } from '../../admin/query/hooks/useEntryDiff';
import { useConfig } from '../../hooks/useConfig';
import { stringifyFieldValue, type FieldDiff } from '../../lib/entryDiff';
import type { CollectionField } from '../../types';

import { DiffHunk } from './DiffHunk';

type DiffViewProps = {
  collectionType: string;
  entryPath: string;
};

const LINE_NUMBERED_FORMATS = new Set(['markdown', 'richtext', 'text', 'json']);

export function DiffView({ collectionType, entryPath }: DiffViewProps) {
  const config = useConfig();
  const diffQuery = useEntryDiff(entryPath);
  const diff = diffQuery.data;

  const collection = (config.collections as Record<string, { label: string; fields: Record<string, CollectionField> }>)[
    collectionType
  ];

  const fieldList = useMemo(() => {
    if (!collection) return [] as Array<[string, CollectionField]>;
    return Object.entries(collection.fields);
  }, [collection]);

  if (diffQuery.isPending && !diff) {
    return (
      <div className="octo-diff-view">
        <div className="octo-diff-view__skeleton-line octo-diff-view__skeleton-line--heading" />
        <div className="octo-diff-view__skeleton-line octo-diff-view__skeleton-line--content" />
        <div className="octo-diff-view__skeleton-line octo-diff-view__skeleton-line--content" />
      </div>
    );
  }

  if (diffQuery.isError || !diff) {
    return <p className="octo-diff-view__error">Could not load diff.</p>;
  }

  if (!diff.changed) {
    return (
      <div className="octo-diff-view__empty">
        <p className="octo-diff-view__empty-title">No unmerged changes for this entry</p>
        <p className="octo-diff-view__empty-sub">
          Active branch <code className="octo-u-mono">{diff.activeBranch || '—'}</code> matches{' '}
          <code className="octo-u-mono">{diff.baseBranch}</code> for this file.
        </p>
      </div>
    );
  }

  return (
    <div className="octo-diff-view">
      <div className="octo-diff-view__branch-row">
        <span>Comparing</span>
        <code className="octo-diff-view__branch-code">{diff.activeBranch}</code>
        <span>→</span>
        <code className="octo-diff-view__branch-code">{diff.baseBranch}</code>
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
    <section className="octo-diff-hunk">
      <header className="octo-diff-hunk__header">
        <label className="octo-diff-hunk__header-label">{fieldDef.label}</label>
        <code className="octo-diff-hunk__header-format">{format}</code>
        {!isUnchanged && (
          <span className="octo-diff-hunk__header-dot" title="Unpublished change" aria-label="Changed" />
        )}
        <div className="octo-diff-hunk__header-spacer" />
        <span className="octo-diff-hunk__header-key">{name}</span>
      </header>

      <div className="octo-diff-hunk__body">
        {isUnchanged ? (
          <p className="octo-diff-hunk__unchanged">No changes</p>
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
    <div className="octo-diff-hunk__image-grid">
      <ImageSide label="Was" uuid={beforeUuid} url={beforeUrl} tone="del" />
      <ImageSide label="Now" uuid={afterUuid} url={afterUrl} tone="add" />
    </div>
  );
}

function ImageSide({ label, uuid, url, tone }: { label: string; uuid: string; url: string; tone: 'add' | 'del' }) {
  return (
    <div className={`octo-diff-hunk__image-side octo-diff-hunk__image-side--${tone}`}>
      <div className="octo-diff-hunk__image-label-row">
        <span className={`octo-diff-hunk__image-badge octo-diff-hunk__image-badge--${tone}`}>{label}</span>
        <code className="octo-diff-hunk__image-uuid">{uuid || '—'}</code>
      </div>
      {url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={url} alt={label} className="octo-diff-hunk__image-preview" />
      ) : (
        <div className="octo-diff-hunk__image-empty">{uuid ? 'No preview' : 'None'}</div>
      )}
    </div>
  );
}
