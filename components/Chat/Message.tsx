'use client';

import React from 'react';
import { Bot, Info, Paperclip, User } from '../ui/icons';

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
      <div className="octo-chat-msg octo-chat-msg--system">
        <Info className="octo-chat-msg__system-icon octo-icon-sm octo-u-shrink-0" />
        <span className="octo-u-whitespace-pre-wrap">{entry.text}</span>
      </div>
    );
  }
  const isUser = entry.kind === 'user';
  return (
    <div
      className={cn(
        'octo-chat-msg',
        isUser ? 'octo-chat-msg octo-chat-msg--user' : 'octo-chat-msg octo-chat-msg--assistant',
      )}
    >
      <div className="octo-chat-msg__avatar">
        {isUser ? <User className="octo-icon-md" /> : <Bot className="octo-icon-md" />}
      </div>
      <div className={cn('octo-chat-msg__body', isUser && 'octo-chat-msg__body octo-chat-msg__body--user')}>
        <div
          className={cn(
            'octo-chat-msg__bubble',
            isUser
              ? 'octo-chat-msg__bubble octo-chat-msg__bubble--user'
              : 'octo-chat-msg__bubble octo-chat-msg__bubble--assistant',
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
    <div className="octo-chat-msg__user-body">
      {entry.attachmentNames && entry.attachmentNames.length > 0 && (
        <div className="octo-chat-msg__attach-names">
          {entry.attachmentNames.map((name, i) => (
            <span key={`${name}-${i}`} className="octo-chat-msg__attach-chip" data-testid="user-attachment-name">
              <Paperclip className="octo-icon-xs" />
              <span className="octo-chat-msg__attach-chip-name">{name}</span>
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
    <div className="octo-chat-msg__assistant-body">
      {isEmpty && entry.streaming && <span className="octo-chat-msg__thinking">Thinking…</span>}
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
      {entry.streaming && entry.text && <span className="octo-chat-msg__cursor" />}
    </div>
  );
}
