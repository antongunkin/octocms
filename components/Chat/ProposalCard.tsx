'use client';

import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, FilePen, FilePlus, Loader2, X } from 'lucide-react';

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
        'my-3 rounded-md border bg-card text-foreground',
        status.kind === 'error' ? 'border-destructive/50' : 'border-border',
        status.kind === 'accepted' && 'opacity-80',
        status.kind === 'rejected' && 'opacity-60',
      )}
    >
      <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
        {isEdit ? (
          <FilePen className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <FilePlus className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className="text-xs font-semibold">{isEdit ? 'Proposed edit' : 'Proposed new entry'}</span>
        <span className="text-xs text-muted-foreground truncate flex-1">{proposal.summary}</span>
        <StatusBadge status={status} />
      </div>

      {proposal.reasoning && (
        <div className="px-3 py-2 text-xs text-muted-foreground italic border-b border-border/50">
          “{proposal.reasoning}”
        </div>
      )}

      <div className="px-3 py-3 space-y-3">
        {isEdit ? <EditProposalBody proposal={proposal} /> : <CreateProposalBody proposal={proposal} />}
      </div>

      {status.kind === 'error' && (
        <div className="border-t border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <div className="font-semibold">Could not save: {status.message}</div>
          {status.fieldErrors && Object.keys(status.fieldErrors).length > 0 && (
            <ul className="mt-1 list-disc pl-4">
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
        <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
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
        <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2">
          <input
            type="text"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Optional reason (helps the agent learn)"
            aria-label="Reason for rejecting"
            className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
        <div className="flex items-center gap-2 border-t border-border/50 px-3 py-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {status.kind === 'accepting' ? 'Saving entry…' : 'Rejecting…'}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ProposalUiState['status'] }) {
  switch (status.kind) {
    case 'pending':
      return <span className="text-[11px] text-muted-foreground">Awaiting approval</span>;
    case 'accepting':
    case 'rejecting':
      return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
    case 'accepted':
      return (
        <span className="flex items-center gap-1 text-[11px] text-emerald-400 light:text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Accepted
        </span>
      );
    case 'rejected':
      return <span className="text-[11px] text-muted-foreground">Rejected</span>;
    case 'error':
      return (
        <span className="flex items-center gap-1 text-[11px] text-destructive">
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
  const [before, setBefore] = React.useState<Record<string, unknown> | null>(null);
  const [loadStatus, setLoadStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  React.useEffect(() => {
    let cancelled = false;
    setLoadStatus('loading');
    (async () => {
      try {
        const { getFile } = await import('../../admin/actions');
        const entry = await getFile(proposal.entryPath);
        if (!cancelled) {
          setBefore((entry?.fields ?? {}) as Record<string, unknown>);
          setLoadStatus('ready');
        }
      } catch {
        if (!cancelled) setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [proposal.entryPath]);

  if (loadStatus === 'loading' || loadStatus === 'idle') {
    return <div className="text-xs text-muted-foreground">Loading current entry…</div>;
  }
  if (loadStatus === 'error') {
    return (
      <div className="text-xs text-destructive">
        Could not load <code className="font-mono">{proposal.entryPath}</code> to compute the diff.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground">
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
            <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              <span className="font-semibold">{def?.label ?? key}</span>
              <code className="font-mono normal-case text-muted-foreground/70">{key}</code>
              {def?.format && <span className="text-muted-foreground/60">({def.format})</span>}
            </div>
            {isLong ? (
              <DiffHunk before={beforeStr} after={afterStr} showLineNumbers={showLineNumbers} />
            ) : (
              <div className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                <div className="rounded border border-red-900/40 bg-red-950/40 px-2 py-1 font-mono text-red-200 light:border-red-200 light:bg-red-50 light:text-red-900">
                  − {beforeStr || <span className="italic text-muted-foreground/70">empty</span>}
                </div>
                <div className="rounded border border-emerald-900/40 bg-emerald-950/40 px-2 py-1 font-mono text-emerald-200 light:border-emerald-200 light:bg-emerald-50 light:text-emerald-900">
                  + {afterStr || <span className="italic text-muted-foreground/70">empty</span>}
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
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        New entry in <span className="font-mono">{proposal.collection}</span>
        {collection?.label ? ` (${collection.label})` : ''}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {Object.entries(fields).map(([key, def]) => {
            const value = proposal.fields[key];
            return (
              <tr key={key} className="border-t border-border/40 first:border-t-0">
                <td className="w-1/3 py-1.5 pr-2 align-top">
                  <span className="font-semibold">{def.label}</span>
                  <span className="ml-2 font-mono text-[10px] text-muted-foreground/70">{def.format}</span>
                </td>
                <td className="py-1.5 align-top">
                  {value == null || value === '' ? (
                    <span className="italic text-muted-foreground/70">unset</span>
                  ) : (
                    <pre className="whitespace-pre-wrap break-words font-mono text-[11px]">{stringify(value)}</pre>
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
