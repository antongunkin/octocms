'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Button, Icon } from '../ui';

import { ErrorBoundary } from '../ErrorBoundary/ErrorBoundary';

import { Composer } from './Composer';
import { Message } from './Message';
import { useChatStream } from './useChatStream';

type Props = {
  /** Initial provider info — used until the SSE `meta` event arrives. */
  initialMeta: { provider: 'anthropic' | 'openai' | 'local'; model: string };
  /** Attachment caps from `agentConfig` — drive Composer UI validation. */
  attachmentLimits: { maxAttachmentBytes: number; maxAttachmentsPerTurn: number };
};

const PROVIDER_LABEL: Record<'anthropic' | 'openai' | 'local', string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  local: 'Local',
};

export default function ChatPage({ initialMeta, attachmentLimits }: Props) {
  const {
    entries,
    meta,
    usage,
    status,
    error,
    budgetReason,
    proposals,
    attachmentDiagnostics,
    send,
    reset,
    stop,
    acceptProposal,
    rejectProposal,
    acceptAllPending,
  } = useChatStream();
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [entries, status]);

  const provider = meta?.provider ?? initialMeta.provider;
  const model = meta?.model ?? initialMeta.model;

  // Identify the latest assistant turn so we can show "Accept all pending"
  // when ≥2 proposals are outstanding for it.
  const latestAssistantId = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].kind === 'assistant') return entries[i].id;
    }
    return null;
  }, [entries]);
  const pendingForLatest = useMemo(() => {
    if (!latestAssistantId) return [];
    return Object.values(proposals).filter(
      (p) => p.assistantEntryId === latestAssistantId && p.status.kind === 'pending',
    );
  }, [proposals, latestAssistantId]);

  return (
    <div className="octo-chat">
      {/* Top bar */}
      <div className="octo-chat__topbar">
        <div className="octo-chat__topbar-left">
          <Icon.Bot className="octo-icon-md" />
          <span className="octo-chat__topbar-title">Chat</span>
          <span className="octo-chat__topbar-meta">
            · {PROVIDER_LABEL[provider]} · <span className="octo-chat__topbar-model">{model}</span>
          </span>
        </div>
        <div className="octo-chat__topbar-right">
          <UsageBadge
            totalCostUSD={usage.totalCostUSD}
            inputTokens={usage.inputTokens}
            outputTokens={usage.outputTokens}
          />
          {status === 'streaming' ? (
            <Button
              variant="destructive"
              onClick={stop}
              className="octo-u-gap-1-5"
              data-testid="chat-stop-button"
              aria-label="Stop generating"
              title="Stop the assistant — keeps whatever it has streamed so far"
            >
              <Icon.StopCircle className="octo-icon-sm" />
              Stop
            </Button>
          ) : (
            <Button variant="outline" onClick={reset} disabled={entries.length === 0} className="octo-u-gap-1-5">
              <Icon.RefreshCw className="octo-icon-sm" />
              New conversation
            </Button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollerRef} className="octo-chat__scroller">
        <div className="octo-chat__transcript">
          {entries.length === 0 && (
            <div className="octo-chat__empty">
              <Icon.Bot className="octo-chat__empty-icon octo-icon-xl" />
              <div className="octo-chat__empty-title">Ask your CMS anything.</div>
              <div className="octo-chat__empty-hint">
                Try: <em>"show me posts about caching"</em> or <em>"fix the typo 'recieve' in any post"</em>.
              </div>
            </div>
          )}
          {entries.map((e) => (
            <ErrorBoundary key={e.id} label="message" resetKeys={[e.id]}>
              <Message
                entry={e}
                proposals={proposals}
                onAcceptProposal={acceptProposal}
                onRejectProposal={rejectProposal}
              />
            </ErrorBoundary>
          ))}

          {pendingForLatest.length >= 2 && status !== 'streaming' && (
            <div className="octo-chat__accept-all-bar">
              <span>
                <strong>{pendingForLatest.length}</strong> proposals pending in this turn.
              </span>
              <Button
                onClick={() => latestAssistantId && acceptAllPending(latestAssistantId)}
                className="octo-u-gap-1-5"
              >
                <Icon.CheckCheck className="octo-icon-sm" />
                Accept all pending
              </Button>
            </div>
          )}

          {attachmentDiagnostics.length > 0 && (
            <div className="octo-chat__attachment-diag">
              <div className="octo-chat__attachment-diag-title">Attachments</div>
              <ul className="octo-chat__attachment-diag-list">
                {attachmentDiagnostics.map((d, i) => (
                  <li key={i}>
                    {d.status === 'ok' ? (
                      <span>
                        ✓ <span className="octo-u-mono">{d.filename}</span> ({d.kind})
                      </span>
                    ) : (
                      <span className="octo-chat__attachment-diag-error">
                        ✗ <span className="octo-u-mono">{d.filename}</span> — {d.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === 'stopped' && (
            <div className="octo-chat__status-bar" role="status">
              Stopped — the assistant was interrupted. Send another message to continue.
            </div>
          )}

          {status === 'error' && error && <div className="octo-chat__error-bar">{error}</div>}
          {status === 'budget_exceeded' && (
            <div className="octo-chat__budget-bar">
              Budget reached ({budgetReason ?? 'unknown'}). Click <strong>New conversation</strong> to start over, or
              raise the caps in <code>cms/octocms.config.ts</code>.
            </div>
          )}
        </div>
      </div>

      {/* Composer — disabled while streaming or after budget hit, but enabled
          after a Stop click so the user can immediately follow up. */}
      <ErrorBoundary label="composer">
        <Composer
          disabled={status === 'streaming' || status === 'budget_exceeded'}
          maxAttachmentBytes={attachmentLimits.maxAttachmentBytes}
          maxAttachmentsPerTurn={attachmentLimits.maxAttachmentsPerTurn}
          onSubmit={send}
        />
      </ErrorBoundary>
    </div>
  );
}

function UsageBadge({
  totalCostUSD,
  inputTokens,
  outputTokens,
}: {
  totalCostUSD: number;
  inputTokens: number;
  outputTokens: number;
}) {
  const cost = totalCostUSD > 0 ? `$${totalCostUSD.toFixed(4)}` : 'free';
  return (
    <span className="octo-chat__usage-badge" title={`Input: ${inputTokens} tokens · Output: ${outputTokens} tokens`}>
      {cost} · {inputTokens + outputTokens} tok
    </span>
  );
}
