'use client';

import * as React from 'react';

import { useToast } from '../../hooks/useToast';
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from './toast';

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      <ToastViewport>
        {toasts.map(({ id, title, description, action, dismiss, ...props }) => (
          <Toast key={id} {...props}>
            <div className="octo-toast__content">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose onClick={dismiss} />
          </Toast>
        ))}
      </ToastViewport>
    </ToastProvider>
  );
}
