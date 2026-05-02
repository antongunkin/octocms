import * as React from 'react';
import { GitCommit } from 'lucide-react';
import { cn } from '../../lib/utils';

type PublishButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  count?: number;
  label?: string;
  size?: 'sm' | 'md';
};

export const PublishButton = React.forwardRef<HTMLButtonElement, PublishButtonProps>(
  ({ className, count = 0, label = 'Publish', size = 'md', ...props }, ref) => {
    const h = size === 'sm' ? 'h-[30px]' : 'h-8';
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'focus-ring inline-flex cursor-pointer items-center gap-2 rounded-full border-0 px-4 text-xs font-semibold',
          h,
          className,
        )}
        style={{
          background: 'var(--brand)',
          color: '#003d29',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.20)',
        }}
        {...props}
      >
        <GitCommit size={13} />
        {label}
        {count > 0 && (
          <span
            className="rounded-[4px] px-1.5 font-mono text-xs font-bold tabular-nums"
            style={{ background: 'rgba(0,61,41,0.18)' }}
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);
PublishButton.displayName = 'PublishButton';
