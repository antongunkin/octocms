import * as React from 'react';
import { cn } from '../../lib/utils';

// ── Card primitives ───────────────────────────────────────────────────────────

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-card', className)} {...props} />,
);
Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-card__header', className)} {...props} />,
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, children, ...props }, ref) => (
    <h3 ref={ref} className={cn('octo-card__title', className)} {...props}>
      {children}
    </h3>
  ),
);
CardTitle.displayName = 'CardTitle';

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-card__content', className)} {...props} />,
);
CardContent.displayName = 'CardContent';

// ── Banner ────────────────────────────────────────────────────────────────────

type Tone = 'info' | 'warn' | 'success' | 'danger' | 'brand';

type BannerProps = {
  tone?: Tone;
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function Banner({ tone = 'info', icon, title, body, action, className }: BannerProps) {
  return (
    <div className={cn('octo-card octo-card--banner', `octo-card--banner-${tone}`, className)}>
      {icon && <span className="octo-card__banner-icon">{icon}</span>}
      <div className="octo-card__banner-body">
        <div className="octo-card__banner-title">{title}</div>
        {body && <div className="octo-card__banner-text">{body}</div>}
      </div>
      {action}
    </div>
  );
}

// ── Empty ─────────────────────────────────────────────────────────────────────

type EmptyProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  cta?: React.ReactNode;
  className?: string;
};

export function Empty({ icon, title, body, cta, className }: EmptyProps) {
  return (
    <div className={cn('octo-card octo-card--empty', className)}>
      {icon && <div className="octo-card__empty-icon">{icon}</div>}
      <div className="octo-card__empty-title">{title}</div>
      {body && <div className="octo-card__empty-text">{body}</div>}
      {cta}
    </div>
  );
}
