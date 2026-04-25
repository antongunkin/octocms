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
    <div
      className={cn(
        'my-2 rounded-md border bg-muted/40 text-xs',
        status === 'error' ? 'border-destructive/40' : 'border-border',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left bg-transparent border-0 cursor-pointer"
      >
        <ChevronRight className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')} />
        <Wrench className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono font-semibold">{call.name}</span>
        <span className="text-muted-foreground truncate flex-1">{inputPreview}</span>
        {status === 'pending' && <span className="text-muted-foreground">…</span>}
        {status === 'ok' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
        {status === 'error' && <AlertCircle className="h-3 w-3 text-destructive" />}
      </button>
      {expanded && (
        <div className="border-t border-border/50 px-3 py-2 space-y-2">
          <div>
            <div className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">Input</div>
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">
              {prettyJson(call.parsedInput, call.inputJson)}
            </pre>
          </div>
          {call.result && (
            <div>
              <div className="text-muted-foreground mb-1 text-[11px] uppercase tracking-wide">Result</div>
              <pre className="whitespace-pre-wrap break-words font-mono text-[11px] text-foreground/80">
                {prettyResult(resultPreview, call.result.content)}
              </pre>
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
