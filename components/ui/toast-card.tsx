'use client';

import * as React from 'react';
import { Bell, Check, GitCommit, Info, TriangleAlert, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastCardTone = 'default' | 'success' | 'error' | 'warn' | 'info' | 'brand';

type ToastCardProps = {
  tone?: ToastCardTone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  time?: React.ReactNode;
  onDismiss?: () => void;
  className?: string;
};

const railColor: Record<ToastCardTone, string> = {
  default: 'var(--border-strong)',
  success: 'var(--ok)',
  error: 'var(--danger)',
  warn: 'var(--st-changed)',
  info: 'var(--accent)',
  brand: 'var(--brand)',
};

const iconStyle: Record<ToastCardTone, React.CSSProperties> = {
  default: { background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text-2)' },
  success: { background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', color: 'var(--ok)' },
  error: { background: 'var(--danger-bg)', border: '1px solid var(--danger-bd)', color: 'var(--danger)' },
  warn: { background: 'var(--st-changed-bg)', border: '1px solid var(--st-changed-bd)', color: 'var(--st-changed)' },
  info: { background: 'var(--accent-bg)', border: '1px solid var(--border)', color: 'var(--accent-fg)' },
  brand: { background: 'var(--brand-bg)', border: '1px solid var(--brand)', color: 'var(--brand-strong)' },
};

const defaultIcon: Record<ToastCardTone, React.ReactNode> = {
  default: <Bell style={{ width: 14, height: 14 }} />,
  success: <Check style={{ width: 14, height: 14 }} />,
  error: <TriangleAlert style={{ width: 14, height: 14 }} />,
  warn: <TriangleAlert style={{ width: 14, height: 14 }} />,
  info: <Info style={{ width: 14, height: 14 }} />,
  brand: <GitCommit style={{ width: 14, height: 14 }} />,
};

export function ToastCard({ tone = 'default', icon, title, body, action, time, onDismiss, className }: ToastCardProps) {
  return (
    <div
      className={cn('octo-toast-card', className)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        minWidth: 360,
        maxWidth: 420,
        borderRadius: 12,
        border: '1px solid var(--border)',
        background: 'var(--surface-1)',
        padding: '12px 12px 12px 14px',
        boxShadow: 'var(--shadow-2)',
      }}
    >
      {/* Left tone rail */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: railColor[tone],
        }}
      />
      {/* Icon chip */}
      <span
        className="octo-toast-card__icon"
        style={{
          display: 'inline-flex',
          height: 28,
          width: 28,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          ...iconStyle[tone],
        }}
      >
        {icon ?? defaultIcon[tone]}
      </span>
      {/* Body */}
      <div className="octo-toast-card__body">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div
            className="octo-toast-card__title"
            style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {title}
          </div>
          {time && (
            <span style={{ flexShrink: 0, fontFamily: 'var(--ft-mono)', fontSize: 10, color: 'var(--muted)' }}>
              {time}
            </span>
          )}
        </div>
        {body && <div className="octo-toast-card__text">{body}</div>}
        {(action || onDismiss) && (
          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 16 }}>
            {action && (
              <button
                type="button"
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--text)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                {action}
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  border: 0,
                  background: 'transparent',
                  padding: 0,
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--muted)',
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
      {/* Dismiss button */}
      <button
        type="button"
        title="Close"
        onClick={onDismiss}
        style={{
          flexShrink: 0,
          display: 'inline-flex',
          height: 24,
          width: 24,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          border: 0,
          background: 'transparent',
          color: 'var(--muted)',
          cursor: 'pointer',
        }}
      >
        <X style={{ width: 12, height: 12 }} />
      </button>
    </div>
  );
}
