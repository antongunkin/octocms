'use client';

import * as React from 'react';
import { Icon } from './icons';
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

const defaultIcon: Record<ToastCardTone, React.ReactNode> = {
  default: <Icon.Bell />,
  success: <Icon.Check />,
  error: <Icon.TriangleAlert />,
  warn: <Icon.TriangleAlert />,
  info: <Icon.Info />,
  brand: <Icon.GitCommit />,
};

export function ToastCard({ tone = 'default', icon, title, body, action, time, onDismiss, className }: ToastCardProps) {
  return (
    <div className={cn('octo-toast-card', `octo-toast-card--${tone}`, className)}>
      <span aria-hidden className="octo-toast-card__rail" />
      <span className="octo-toast-card__icon">{icon ?? defaultIcon[tone]}</span>
      <div className="octo-toast-card__body">
        <div className="octo-toast-card__header">
          <div className="octo-toast-card__title">{title}</div>
          {time && <span className="octo-toast-card__time">{time}</span>}
        </div>
        {body && <div className="octo-toast-card__text">{body}</div>}
        {(action || onDismiss) && (
          <div className="octo-toast-card__actions">
            {action && (
              <button type="button" className="octo-toast-card__action-btn">
                {action}
              </button>
            )}
            {onDismiss && (
              <button type="button" onClick={onDismiss} className="octo-toast-card__dismiss">
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>
      <button type="button" title="Close" onClick={onDismiss} className="octo-toast-card__close">
        <Icon.X />
      </button>
    </div>
  );
}
