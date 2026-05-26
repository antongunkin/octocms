import * as React from 'react';

import { cn } from '../../../lib/utils';

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
