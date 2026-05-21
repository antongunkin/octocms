'use client';

import * as ToastPrimitives from '@radix-ui/react-toast';
import { X } from 'lucide-react';
import React from 'react';

import { cn } from '../../lib/utils';

const ToastProvider = ToastPrimitives.Provider;

const ToastViewport = ({ className, ...props }: React.ComponentProps<typeof ToastPrimitives.Viewport>) => (
  <ToastPrimitives.Viewport className={cn('octo-toast__viewport', className)} {...props} />
);
ToastViewport.displayName = ToastPrimitives.Viewport.displayName;

type ToastVariant = 'default' | 'destructive' | 'success';

type ToastProps = React.ComponentProps<typeof ToastPrimitives.Root> & {
  variant?: ToastVariant;
};

const Toast = ({ className, variant = 'default', ...props }: ToastProps) => (
  <ToastPrimitives.Root
    className={cn(
      'octo-toast',
      variant === 'default' && 'octo-toast--default',
      variant === 'destructive' && 'octo-toast--destructive',
      variant === 'success' && 'octo-toast--success',
      className,
    )}
    {...props}
  />
);
Toast.displayName = ToastPrimitives.Root.displayName;

const ToastAction = ({ className, ...props }: React.ComponentProps<typeof ToastPrimitives.Action>) => (
  <ToastPrimitives.Action className={cn('octo-toast__action', className)} {...props} />
);
ToastAction.displayName = ToastPrimitives.Action.displayName;

const ToastClose = ({ className, ...props }: React.ComponentProps<typeof ToastPrimitives.Close>) => (
  <ToastPrimitives.Close className={cn('octo-toast__close', className)} toast-close="" {...props}>
    <X />
  </ToastPrimitives.Close>
);
ToastClose.displayName = ToastPrimitives.Close.displayName;

const ToastTitle = ({ className, ...props }: React.ComponentProps<typeof ToastPrimitives.Title>) => (
  <ToastPrimitives.Title className={cn('octo-toast__title', className)} {...props} />
);
ToastTitle.displayName = ToastPrimitives.Title.displayName;

const ToastDescription = ({ className, ...props }: React.ComponentProps<typeof ToastPrimitives.Description>) => (
  <ToastPrimitives.Description className={cn('octo-toast__description', className)} {...props} />
);
ToastDescription.displayName = ToastPrimitives.Description.displayName;

export { Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport };
export type { ToastProps };
