'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Bot, CheckCheck, RefreshCw, StopCircle } from 'lucide-react';

import { Button } from '../ui/button';
import { ErrorBoundary } from '../ErrorBoundary';

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

export function ChatPage({ initialMeta, attachmentLimits }: Props) {
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
    <div className="flex h-[calc(100dvh-3.5rem)] flex-1 flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Chat</span>
          <span className="text-muted-foreground">
            · {PROVIDER_LABEL[provider]} · <span className="font-mono text-xs">{model}</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <UsageBadge
            totalCostUSD={usage.totalCostUSD}
            inputTokens={usage.inputTokens}
            outputTokens={usage.outputTokens}
          />
          {status === 'streaming' ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={stop}
              className="gap-1.5"
              data-testid="chat-stop-button"
              aria-label="Stop generating"
              title="Stop the assistant — keeps whatever it has streamed so far"
            >
              <StopCircle className="h-3.5 w-3.5" />
              Stop
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={reset} disabled={entries.length === 0} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              New conversation
            </Button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div ref={scrollerRef} className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto max-w-3xl py-4">
          {entries.length === 0 && (
            <div className="mt-12 text-center text-sm text-muted-foreground">
              <Bot className="mx-auto mb-3 h-8 w-8 opacity-50" />
              <div className="font-medium">Ask your CMS anything.</div>
              <div className="mt-1">
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
            <div className="my-3 flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              <span>
                <strong>{pendingForLatest.length}</strong> proposals pending in this turn.
              </span>
              <Button
                size="sm"
                onClick={() => latestAssistantId && acceptAllPending(latestAssistantId)}
                className="gap-1.5"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Accept all pending
              </Button>
            </div>
          )}

          {attachmentDiagnostics.length > 0 && (
            <div className="my-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs">
              <div className="font-medium mb-1">Attachments</div>
              <ul className="space-y-0.5">
                {attachmentDiagnostics.map((d, i) => (
                  <li key={i}>
                    {d.status === 'ok' ? (
                      <span>
                        ✓ <span className="font-mono">{d.filename}</span> ({d.kind})
                      </span>
                    ) : (
                      <span className="text-destructive">
                        ✗ <span className="font-mono">{d.filename}</span> — {d.reason}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status === 'stopped' && (
            <div
              className="my-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
              role="status"
            >
              Stopped — the assistant was interrupted. Send another message to continue.
            </div>
          )}

          {status === 'error' && error && (
            <div className="my-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          {status === 'budget_exceeded' && (
            <div className="my-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
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
    <span
      className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 font-mono text-[11px] text-muted-foreground"
      title={`Input: ${inputTokens} tokens · Output: ${outputTokens} tokens`}
    >
      {cost} · {inputTokens + outputTokens} tok
    </span>
  );
}
