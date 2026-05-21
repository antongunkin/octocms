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
    <div className={cn('octo-field', className)} role="status" aria-label="Loading field" style={{ gap: 6 }}>
      <ShimmerBlock style={{ height: 12, width: 96 }} />
      <ShimmerBlock style={{ height: 36, width: '100%' }} />
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
      className={cn('octo-card', className)}
      style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <ShimmerBlock style={{ height: 16, width: '33%' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }, (_, i) => (
          <ShimmerBlock key={i} style={{ height: 12, width: '100%' }} />
        ))}
      </div>
    </div>
  );
}
