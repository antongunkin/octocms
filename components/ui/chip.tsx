'use client';

import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { X } from 'lucide-react';
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
    <span ref={ref} className={cn('octo-chip', mono && 'octo-chip--mono', className)} {...props}>
      {children}
      {removable && (
        <button type="button" onClick={onRemove} aria-label="Remove" className="octo-chip__remove">
          <X size={11} />
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
        size === 'sm' ? 'octo-chip--status-sm' : 'octo-chip--status-md',
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

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root ref={ref} className={cn('octo-chip octo-chip--avatar', className)} {...props} />
));
Avatar.displayName = AvatarPrimitive.Root.displayName;

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn('octo-chip__avatar-img', className)} {...props} />
));
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback ref={ref} className={cn('octo-chip__avatar-fallback', className)} {...props} />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

// ── AvatarStack ───────────────────────────────────────────────────────────────

type Person = {
  name?: string;
  initials: string;
  color: string;
};

type AvatarStackProps = {
  people: Person[];
  size?: number;
  className?: string;
};

export function AvatarStack({ people, size = 24, className }: AvatarStackProps) {
  return (
    <div className={cn('octo-chip__stack', className)}>
      {people.map((p, i) => (
        <div key={`${p.initials}-${i}`} style={{ marginLeft: i ? -7 : 0 }} title={p.name ?? p.initials}>
          <span
            className="octo-chip__stack-item"
            style={{
              width: size,
              height: size,
              background: p.color,
              fontSize: size <= 22 ? 10 : size <= 28 ? 11.5 : 13,
            }}
          >
            {p.initials}
          </span>
        </div>
      ))}
    </div>
  );
}
