import * as React from 'react';

import { cn } from '../../../lib/utils';

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
