'use client';

import React, { useState } from 'react';
import { ChevronRight, Wrench, AlertCircle, CheckCircle2 } from 'lucide-react';

import { cn } from '../../lib/utils';

import type { ChatToolCall } from './types';

type Props = {
  call: ChatToolCall;
};

export function ToolCallCard({ call }: Props) {
  const [expanded, setExpanded] = useState(false);
  const status = call.result ? (call.result.isError ? 'error' : 'ok') : 'pending';

  const inputPreview = formatInputPreview(call.parsedInput, call.inputJson);
  const resultPreview = call.result ? truncate(call.result.content, 280) : 'Running…';

  return (
    <div className={cn('octo-tool-call-card', status === 'error' && 'octo-tool-call-card--error')}>
      <button type="button" onClick={() => setExpanded((v) => !v)} className="octo-tool-call-card__toggle">
        <ChevronRight
          className={cn('octo-tool-call-card__chevron h-3 w-3', expanded && 'octo-tool-call-card__chevron--open')}
        />
        <Wrench className="octo-tool-call-card__icon h-3 w-3" />
        <span className="octo-tool-call-card__name">{call.name}</span>
        <span className="octo-tool-call-card__preview">{inputPreview}</span>
        {status === 'pending' && <span className="octo-tool-call-card__status">…</span>}
        {status === 'ok' && (
          <CheckCircle2 className="h-3 w-3 octo-tool-call-card__status" style={{ color: 'var(--ok)' }} />
        )}
        {status === 'error' && (
          <AlertCircle className="h-3 w-3 octo-tool-call-card__status" style={{ color: 'var(--danger)' }} />
        )}
      </button>
      {expanded && (
        <div className="octo-tool-call-card__body">
          <div>
            <div className="octo-tool-call-card__section-label">Input</div>
            <pre className="octo-tool-call-card__pre">{prettyJson(call.parsedInput, call.inputJson)}</pre>
          </div>
          {call.result && (
            <div>
              <div className="octo-tool-call-card__section-label">Result</div>
              <pre className="octo-tool-call-card__pre">{prettyResult(resultPreview, call.result.content)}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatInputPreview(parsed: unknown, raw: string): string {
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    const first = keys[0];
    const value = obj[first];
    return `${first}=${formatScalar(value)}${keys.length > 1 ? ', …' : ''}`;
  }
  return truncate(raw || '', 60);
}

function formatScalar(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(truncate(v, 40));
  if (typeof v === 'number' || typeof v === 'boolean' || v === null) return String(v);
  return '…';
}

function prettyJson(parsed: unknown, raw: string): string {
  if (parsed === undefined) return raw || '(no input yet)';
  try {
    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw || String(parsed);
  }
}

function prettyResult(_preview: string, content: string): string {
  try {
    const parsed = JSON.parse(content);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return content;
  }
}

function truncate(s: string, n: number): string {
  if (!s) return '';
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}
