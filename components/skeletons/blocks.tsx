import React from 'react';

import { cn } from '../../lib/utils';

import { ShimmerBlock } from './primitives';

/**
 * Cross-cutting block-level skeletons reused across admin pages.
 * Smaller than page skeletons, larger than primitives — sized to drop into
 * a real layout slot so layout shift is minimal when content resolves.
 */

/**
 * Single label + input pair, sized to match a typical form row in the entry
 * editor and content-type detail. Width follows the surrounding container.
 */
export function FormFieldSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} role="status" aria-label="Loading field">
      <ShimmerBlock className="h-3 w-24" />
      <ShimmerBlock className="h-9 w-full" />
    </div>
  );
}

/**
 * Generic content card: header line, then `lines` body rows. Used for entry
 * sidebar cards (History, Linked By) and any boxed content slot.
 */
export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading card"
      className={cn('flex flex-col gap-3 rounded-xl border border-border bg-[var(--surface-1)] p-4', className)}
    >
      <ShimmerBlock className="h-4 w-1/3" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }, (_, i) => (
          <ShimmerBlock key={i} className="h-3 w-full" />
        ))}
      </div>
    </div>
  );
}
