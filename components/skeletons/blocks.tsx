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
    <div
      className={cn('octo-field', 'octo-field octo-field--skel', className)}
      role="status"
      aria-label="Loading field"
    >
      <ShimmerBlock className="octo-skel-h-3 octo-skel-w-24" />
      <ShimmerBlock className="octo-skel-h-9 octo-skel-w-full" />
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
      className={cn('octo-card', 'octo-card octo-card--skel-layout', className)}
    >
      <ShimmerBlock className="octo-skel-h-4" style={{ width: '33%' }} />
      <div className="octo-card__skel-lines">
        {Array.from({ length: lines }, (_, i) => (
          <ShimmerBlock key={i} className="octo-skel-h-3 octo-skel-w-full" />
        ))}
      </div>
    </div>
  );
}
