'use client';

import * as React from 'react';
import { Icon } from './icons';
import { cn } from '../../lib/utils';
import type { EntryStatus } from '../../types';

// ── Chip ──────────────────────────────────────────────────────────────────────

type ChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  removable?: boolean;
  mono?: boolean;
  onRemove?: () => void;
};

export const Chip = React.forwardRef<HTMLSpanElement, ChipProps>(
  ({ className, children, removable, mono, onRemove, ...props }, ref) => (
    <span ref={ref} className={cn('octo-chip', mono && 'octo-chip octo-chip--mono', className)} {...props}>
      {children}
      {removable && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="octo-chip__remove">
          <Icon.X size={11} />
        </button>
      )}
    </span>
  ),
);
Chip.displayName = 'Chip';

// ── Kbd ───────────────────────────────────────────────────────────────────────

export const Kbd = React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  ({ className, children, ...props }, ref) => (
    <kbd ref={ref} className={cn('octo-chip octo-chip--kbd', className)} {...props}>
      {children}
    </kbd>
  ),
);
Kbd.displayName = 'Kbd';

// ── StatusBadge ───────────────────────────────────────────────────────────────

type StatusInfo = {
  label: string;
  desc: string;
};

export const STATUSES: Record<EntryStatus, StatusInfo> = {
  draft: { label: 'Draft', desc: 'Not yet committed' },
  changed: { label: 'Changed', desc: 'Unpublished edits on a feature branch' },
  published: { label: 'Published', desc: 'Live on main' },
  merged: { label: 'Merged', desc: 'PR merged into main' },
  archived: { label: 'Archived', desc: 'Removed from listing' },
};

type StatusBadgeProps = {
  status: EntryStatus;
  variant?: 'badge' | 'dot';
  size?: 'sm' | 'md';
  className?: string;
};

const sizeStyles = {
  sm: { padding: '2px 8px', fontSize: 11, dot: 6 },
  md: { padding: '4px 10px', fontSize: 12, dot: 6 },
};

export function StatusBadge({ status, variant = 'badge', size = 'md', className }: StatusBadgeProps) {
  const info = STATUSES[status];
  if (!info) return null;
  const sz = sizeStyles[size];
  const fg = `var(--st-${status})`;
  const bg = `var(--st-${status}-bg)`;
  const bd = `var(--st-${status}-bd)`;

  if (variant === 'dot') {
    return (
      <span
        className={cn('octo-chip octo-chip--status octo-chip--status-dot', className)}
        style={{ fontSize: sz.fontSize }}
      >
        <span className="octo-chip__status-dot" style={{ background: fg }} />
        {info.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'octo-chip octo-chip--status',
        size === 'sm' ? 'octo-chip octo-chip--status-sm' : 'octo-chip octo-chip--status-md',
        className,
      )}
      style={{
        background: bg,
        color: fg,
        borderColor: bd,
      }}
    >
      <span className="octo-chip__status-dot" style={{ width: sz.dot, height: sz.dot, background: fg }} />
      {info.label}
    </span>
  );
}

// ── Avatar ────────────────────────────────────────────────────────────────────

type AvatarImageStatus = 'idle' | 'loaded' | 'error';
type AvatarContextValue = {
  status: AvatarImageStatus;
  onLoad: () => void;
  onError: () => void;
};
const AvatarContext = React.createContext<AvatarContextValue>({
  status: 'idle',
  onLoad: () => {},
  onError: () => {},
});

export const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    const [status, setStatus] = React.useState<AvatarImageStatus>('idle');
    return (
      <AvatarContext.Provider value={{ status, onLoad: () => setStatus('loaded'), onError: () => setStatus('error') }}>
        <span ref={ref} className={cn('octo-chip octo-chip--avatar', className)} {...props} />
      </AvatarContext.Provider>
    );
  },
);
Avatar.displayName = 'Avatar';

export const AvatarImage = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  ({ className, src, onLoad, onError, ...props }, ref) => {
    const ctx = React.useContext(AvatarContext);
    // Empty string src causes the browser to re-download the page; treat it as absent.
    const resolvedSrc = src || undefined;
    return (
      <img
        ref={ref}
        src={resolvedSrc}
        alt=""
        className={cn('octo-chip__avatar-img', className)}
        onLoad={(e) => {
          ctx.onLoad();
          onLoad?.(e);
        }}
        onError={(e) => {
          ctx.onError();
          onError?.(e);
        }}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = 'AvatarImage';

export const AvatarFallback = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => {
    const { status } = React.useContext(AvatarContext);
    if (status === 'loaded') return null;
    return <span ref={ref} className={cn('octo-chip__avatar-fallback', className)} {...props} />;
  },
);
AvatarFallback.displayName = 'AvatarFallback';
