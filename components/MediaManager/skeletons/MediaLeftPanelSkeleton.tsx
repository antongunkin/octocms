import React from 'react';

import { ShimmerBlock } from '../../skeletons/primitives';

/**
 * Mirrors `MediaLeftPanel` chrome — 248px sidebar, "All files" pill,
 * Folders header, then folder rows.
 */
export function MediaLeftPanelSkeleton() {
  return (
    <aside
      role="status"
      aria-label="Loading folders"
      className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--surface-2)]"
    >
      <div className="px-3 py-4">
        <ShimmerBlock className="mb-3 h-7 w-full rounded-lg" />
        <ShimmerBlock className="mb-2 ml-2 h-3 w-16" />
        <div className="flex flex-col gap-1.5">
          {Array.from({ length: 5 }, (_, i) => (
            <ShimmerBlock key={i} className="h-7 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </aside>
  );
}
