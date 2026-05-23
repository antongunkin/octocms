'use client';

import * as React from 'react';

import { cn } from '../../lib/utils';
import { X } from './icons';
import { Portal } from './Portal';

// ── ToastProvider ─────────────────────────────────────────────────────────────
// Pass-through — the real viewport lives inside ToastViewport via Portal.

const ToastProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
ToastProvider.displayName = 'ToastProvider';

// ── ToastViewport ─────────────────────────────────────────────────────────────

const ToastViewport = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <Portal>
      <ol
        ref={ref}
        className={cn('octo-toast__viewport', className)}
        aria-live="polite"
        aria-atomic="false"
        tabIndex={-1}
        {...props}
      />
    </Portal>
  ),
);
ToastViewport.displayName = 'ToastViewport';

// ── Toast ─────────────────────────────────────────────────────────────────────

type ToastVariant = 'default' | 'destructive' | 'success';

type ToastProps = React.HTMLAttributes<HTMLLIElement> & {
  variant?: ToastVariant;
  open?: boolean;
};

const Toast = React.forwardRef<HTMLLIElement, ToastProps>(
  ({ className, variant = 'default', open = true, ...props }, ref) => (
    <li
      ref={ref}
      role="status"
      aria-live="off"
      data-state={open ? 'open' : 'closed'}
      className={cn(
        'octo-toast',
        variant === 'destructive' && 'octo-toast--destructive',
        variant === 'success' && 'octo-toast--success',
        className,
      )}
      {...props}
    />
  ),
);
Toast.displayName = 'Toast';

// ── ToastTitle ────────────────────────────────────────────────────────────────

const ToastTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-toast__title', className)} {...props} />,
);
ToastTitle.displayName = 'ToastTitle';

// ── ToastDescription ──────────────────────────────────────────────────────────

const ToastDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('octo-toast__description', className)} {...props} />,
);
ToastDescription.displayName = 'ToastDescription';

// ── ToastClose ────────────────────────────────────────────────────────────────

const ToastClose = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn('octo-toast__close', className)}
      aria-label="Dismiss notification"
      {...props}
    >
      <X />
    </button>
  ),
);
ToastClose.displayName = 'ToastClose';

// ── ToastAction ───────────────────────────────────────────────────────────────

const ToastAction = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className, ...props }, ref) => (
    <button ref={ref} type="button" className={cn('octo-toast__action', className)} {...props} />
  ),
);
ToastAction.displayName = 'ToastAction';

export { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport };
export type { ToastProps };
