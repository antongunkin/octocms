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
import { Icon } from '../ui';

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
    return <p className="octo-dialog-field__hint">{emptyMessage}</p>;
  }
  const visible = items.slice(0, limit);
  const overflow = Math.max(items.length - limit, 0);

  return (
    <div className={cn('octo-schema-impact', `octo-schema-impact--${tone}`)}>
      {title ? (
        <div className="octo-schema-impact__title">
          <Icon.AlertTriangle className="octo-icon-sm" />
          {title}
        </div>
      ) : null}
      <ul className="octo-schema-impact__list">
        {visible.map((it) => (
          <ImpactRow key={it.path} item={it} asLink={asLinks} />
        ))}
        {overflow > 0 ? (
          <li className="octo-u-italic" style={{ paddingLeft: 8 }}>
            …and {overflow} more.
          </li>
        ) : null}
      </ul>
    </div>
  );
}

function ImpactRow({ item, asLink }: { item: SchemaImpactItem; asLink: boolean }) {
  const inner = (
    <span className="octo-schema-impact__item-inner">
      <span className="octo-schema-impact__item-body">
        <span className="octo-schema-impact__item-title">{item.title}</span>
        <span className="octo-schema-impact__item-meta">
          <code className="octo-u-mono">{item.type}</code> · {item.reasons.join('; ')}
        </span>
        {item.warnings.length > 0 ? (
          <span className="octo-schema-impact__item-warnings">⚠ {item.warnings.join('; ')}</span>
        ) : null}
      </span>
      <DataLossBadge dataLoss={item.dataLoss} />
      {asLink ? <Icon.ArrowRight className="octo-icon-sm octo-u-shrink-0 octo-u-opacity-50" /> : null}
    </span>
  );

  // /cms/content/<type>/<id> matches the existing entry-editor route.
  const href = `/cms/content/${item.type}/${item.id}`;

  return (
    <li className="octo-schema-impact__item">
      {asLink ? (
        <Link href={href} target="_blank" rel="noreferrer" className="octo-schema-impact__item-link">
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
      <span className={cn('octo-schema-impact__badge', 'octo-schema-impact__badge octo-schema-impact__badge--loss')}>
        <Icon.ShieldAlert className="octo-icon-xs" />
        Data loss
      </span>
    );
  }
  return (
    <span className={cn('octo-schema-impact__badge', 'octo-schema-impact__badge octo-schema-impact__badge--ok')}>
      <Icon.ShieldCheck className="octo-icon-xs" />
      Preserved
    </span>
  );
}
