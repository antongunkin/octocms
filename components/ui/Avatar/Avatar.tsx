'use client';

import * as React from 'react';

import { cn } from '../../../lib/utils';

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
