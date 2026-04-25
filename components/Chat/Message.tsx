'use client';

import React from 'react';
import { Bot, Info, Paperclip, User } from 'lucide-react';

import { cn } from '../../lib/utils';

import { ProposalCard } from './ProposalCard';
import { ToolCallCard } from './ToolCallCard';
import type { ChatEntry, ProposalUiState } from './types';

type Props = {
  entry: ChatEntry;
  proposals: Record<string, ProposalUiState>;
  onAcceptProposal(id: string): void;
  onRejectProposal(id: string, reason?: string): void;
};

export function Message({ entry, proposals, onAcceptProposal, onRejectProposal }: Props) {
  if (entry.kind === 'system') {
    return (
      <div className="my-3 flex items-start gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span className="whitespace-pre-wrap">{entry.text}</span>
      </div>
    );
  }
  const isUser = entry.kind === 'user';
  return (
    <div className={cn('flex gap-3 py-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn('flex-1 min-w-0 max-w-[760px]', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap break-words',
            isUser ? 'bg-blue-600 text-white text-left' : 'bg-muted text-foreground border border-border/50',
          )}
        >
          {entry.kind === 'assistant' ? (
            <AssistantBody
              entry={entry}
              proposals={proposals}
              onAcceptProposal={onAcceptProposal}
              onRejectProposal={onRejectProposal}
            />
          ) : (
            <UserBody entry={entry} />
          )}
        </div>
      </div>
    </div>
  );
}

function UserBody({ entry }: { entry: Extract<ChatEntry, { kind: 'user' }> }) {
  return (
    <div className="space-y-1.5">
      {entry.attachmentNames && entry.attachmentNames.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {entry.attachmentNames.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="inline-flex items-center gap-1 rounded-full bg-blue-700/40 px-2 py-0.5 text-xs"
              data-testid="user-attachment-name"
            >
              <Paperclip className="h-3 w-3" />
              <span className="max-w-[180px] truncate">{name}</span>
            </span>
          ))}
        </div>
      )}
      {entry.text && <div>{entry.text}</div>}
    </div>
  );
}

function AssistantBody({
  entry,
  proposals,
  onAcceptProposal,
  onRejectProposal,
}: {
  entry: Extract<ChatEntry, { kind: 'assistant' }>;
  proposals: Record<string, ProposalUiState>;
  onAcceptProposal(id: string): void;
  onRejectProposal(id: string, reason?: string): void;
}) {
  const isEmpty = !entry.text && entry.toolCalls.length === 0 && entry.proposalIds.length === 0;
  return (
    <div className="space-y-1">
      {isEmpty && entry.streaming && <span className="text-muted-foreground">Thinking…</span>}
      {entry.toolCalls.map((tc) => (
        <ToolCallCard key={tc.id} call={tc} />
      ))}
      {entry.proposalIds
        .map((id) => proposals[id])
        .filter((p): p is ProposalUiState => Boolean(p))
        .map((p) => (
          <ProposalCard key={p.proposal.id} state={p} onAccept={onAcceptProposal} onReject={onRejectProposal} />
        ))}
      {entry.text && <div>{entry.text}</div>}
      {entry.streaming && entry.text && (
        <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-baseline" />
      )}
    </div>
  );
}
