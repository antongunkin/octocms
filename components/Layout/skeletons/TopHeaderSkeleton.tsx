import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Static shimmer for the sticky admin bar while layout/providers bootstrap.
 * Mirrors `TopHeader` spacing, height (`h-14`), and surface tokens. Branch
 * chip uses the same footprint as `BranchChipSkeleton` (no nested
 * `role="status"` — the bootstrap root owns the live region).
 */
export function TopHeaderSkeleton() {
  return (
    <header className="octo-top-header" aria-hidden>
      <ShimmerBlock
        style={{ height: 32, width: 120, flexShrink: 0, borderRadius: 9999, border: '1px solid var(--border)' }}
      />
      <span className="octo-top-header__sep" />
      <nav className="octo-top-header__nav">
        {Array.from({ length: 4 }, (_, i) => (
          <ShimmerBlock key={i} style={{ height: 32, width: 76, flexShrink: 0, borderRadius: 9999 }} />
        ))}
      </nav>
      <div className="octo-top-header__spacer" />
      <ShimmerBlock
        style={{
          height: 32,
          width: 150,
          flexShrink: 0,
          borderRadius: 9999,
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
        }}
      />
      <span className="octo-top-header__sep" />
      <ShimmerBlock
        style={{
          height: 32,
          width: 88,
          flexShrink: 0,
          borderRadius: 9999,
          border: '1px solid var(--border)',
          background: 'var(--surface-1)',
        }}
      />
      <ShimmerBlock style={{ height: 26, width: 26, flexShrink: 0, borderRadius: 9999 }} />
    </header>
  );
}
