'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, FilePen, FilePlus, Loader2, X } from 'lucide-react';

import { useEntry } from '../../admin/query/hooks/useEntry';
import { useConfig } from '../../hooks/useConfig';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { DiffHunk } from '../DiffView/DiffHunk';

import type { Proposal, ProposalUiState } from './types';

type Props = {
  state: ProposalUiState;
  onAccept(id: string): void;
  onReject(id: string, reason?: string): void;
};

export function ProposalCard({ state, onAccept, onReject }: Props) {
  const { proposal, status } = state;
  const isEdit = proposal.kind === 'edit';
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const isPending = status.kind === 'pending';
  const isBusy = status.kind === 'accepting' || status.kind === 'rejecting';

  return (
    <div
      className={cn(
        'octo-proposal-card',
        status.kind === 'error' && 'octo-proposal-card--error',
        status.kind === 'accepted' && 'octo-proposal-card--accepted',
        status.kind === 'rejected' && 'octo-proposal-card--rejected',
      )}
    >
      <div className="octo-proposal-card__header">
        {isEdit ? (
          <FilePen className="h-3.5 w-3.5 octo-proposal-card__header-icon" />
        ) : (
          <FilePlus className="h-3.5 w-3.5 octo-proposal-card__header-icon" />
        )}
        <span className="octo-proposal-card__kind">{isEdit ? 'Proposed edit' : 'Proposed new entry'}</span>
        <span className="octo-proposal-card__summary">{proposal.summary}</span>
        <StatusBadge status={status} />
      </div>

      {proposal.reasoning && <div className="octo-proposal-card__reasoning">&ldquo;{proposal.reasoning}&rdquo;</div>}

      <div className="octo-proposal-card__body">
        {isEdit ? <EditProposalBody proposal={proposal} /> : <CreateProposalBody proposal={proposal} />}
      </div>

      {status.kind === 'error' && (
        <div className="octo-proposal-card__error-box">
          <div className="octo-proposal-card__error-title">Could not save: {status.message}</div>
          {status.fieldErrors && Object.keys(status.fieldErrors).length > 0 && (
            <ul className="octo-proposal-card__error-list">
              {Object.entries(status.fieldErrors).map(([k, msg]) => (
                <li key={k}>
                  <code className="font-mono">{k}</code>: {msg}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isPending && !showRejectInput && (
        <div className="octo-proposal-card__actions">
          <Button size="sm" onClick={() => onAccept(proposal.id)} disabled={isBusy} className="gap-1.5">
            <Check className="h-3.5 w-3.5" />
            Accept
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowRejectInput(true)}
            disabled={isBusy}
            className="gap-1.5"
          >
            <X className="h-3.5 w-3.5" />
            Reject
          </Button>
        </div>
      )}

      {isPending && showRejectInput && (
        <div className="octo-proposal-card__actions">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional reason (helps the agent learn)"
            aria-label="Reason for rejecting"
            className="octo-proposal-card__reject-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onReject(proposal.id, rejectReason.trim() || undefined);
              }
            }}
          />
          <Button
            size="sm"
            variant="destructive"
            onClick={() => onReject(proposal.id, rejectReason.trim() || undefined)}
          >
            Confirm reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowRejectInput(false);
              setRejectReason('');
            }}
          >
            Cancel
          </Button>
        </div>
      )}

      {isBusy && (
        <div className="octo-proposal-card__busy">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {status.kind === 'accepting' ? 'Saving entry...' : 'Rejecting...'}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalUiState['status'] }) {
  switch (status.kind) {
    case 'pending':
      return <span className="octo-proposal-card__status">Awaiting approval</span>;
    case 'accepting':
    case 'rejecting':
      return <Loader2 className="h-3.5 w-3.5 animate-spin octo-proposal-card__status" />;
    case 'accepted':
      return (
        <span className="octo-proposal-card__status octo-proposal-card__status--accepted">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Accepted
        </span>
      );
    case 'rejected':
      return <span className="octo-proposal-card__status">Rejected</span>;
    case 'error':
      return (
        <span className="octo-proposal-card__status octo-proposal-card__status--error">
          <AlertCircle className="h-3.5 w-3.5" />
          Error
        </span>
      );
  }
}

/**
 * Render the edit proposal as per-field "before vs after" hunks. The "before"
 * comes from the live entry on disk (fetched lazily); the "after" merges the
 * proposed `fieldChanges` over the existing fields.
 */
function EditProposalBody({ proposal }: { proposal: Extract<Proposal, { kind: 'edit' }> }) {
  const config = useConfig();
  const collection = (
    config.collections as Record<string, { fields: Record<string, { label: string; format: string }> }>
  )[proposal.collection];
  const fields = collection?.fields ?? {};
  const entryQuery = useEntry(proposal.entryPath);
  const before = (entryQuery.data?.fields ?? null) as Record<string, unknown> | null;

  if (entryQuery.isPending && entryQuery.data === undefined) {
    return <div className="octo-proposal-card__loading">Loading current entry...</div>;
  }
  if (entryQuery.isError) {
    return (
      <div className="octo-proposal-card__load-error">
        Could not load <code className="font-mono">{proposal.entryPath}</code> to compute the diff.
      </div>
    );
  }

  return (
    <div className="octo-proposal-card__changes">
      <div className="octo-proposal-card__entry-path">
        <span className="font-mono">{proposal.entryPath}</span>
      </div>
      {Object.entries(proposal.fieldChanges).map(([key, afterVal]) => {
        const def = fields[key];
        const beforeStr = stringify(before?.[key]);
        const afterStr = stringify(afterVal);
        const isLong = beforeStr.length + afterStr.length > 80 || beforeStr.includes('\n') || afterStr.includes('\n');
        const showLineNumbers = def?.format === 'markdown' || def?.format === 'richtext' || def?.format === 'text';
        return (
          <div key={key}>
            <div className="octo-proposal-card__field-label">
              <span className="font-semibold">{def?.label ?? key}</span>
              <code className="font-mono octo-proposal-card__field-key">{key}</code>
              {def?.format && <span className="octo-proposal-card__field-format">({def.format})</span>}
            </div>
            {isLong ? (
              <DiffHunk before={beforeStr} after={afterStr} showLineNumbers={showLineNumbers} />
            ) : (
              <div className="octo-proposal-card__inline-diff">
                <div className="octo-proposal-card__inline-before">
                  − {beforeStr || <span className="octo-proposal-card__empty-val">empty</span>}
                </div>
                <div className="octo-proposal-card__inline-after">
                  + {afterStr || <span className="octo-proposal-card__empty-val">empty</span>}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreateProposalBody({ proposal }: { proposal: Extract<Proposal, { kind: 'create' }> }) {
  const config = useConfig();
  const collection = (
    config.collections as Record<string, { label: string; fields: Record<string, { label: string; format: string }> }>
  )[proposal.collection];
  const fields = collection?.fields ?? {};
  return (
    <div className="octo-proposal-card__create">
      <div className="octo-proposal-card__create-meta">
        New entry in <span className="font-mono">{proposal.collection}</span>
        {collection?.label ? ` (${collection.label})` : ''}
      </div>
      <table className="octo-proposal-card__create-table">
        <tbody>
          {Object.entries(fields).map(([key, def]) => {
            const value = proposal.fields[key];
            return (
              <tr key={key} className="octo-proposal-card__create-row">
                <td className="octo-proposal-card__create-key">
                  <span className="font-semibold">{def.label}</span>
                  <span className="octo-proposal-card__create-format">{def.format}</span>
                </td>
                <td className="octo-proposal-card__create-val">
                  {value == null || value === '' ? (
                    <span className="octo-proposal-card__empty-val">unset</span>
                  ) : (
                    <pre className="octo-proposal-card__create-pre">{stringify(value)}</pre>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function stringify(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
