import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/** Mirrors `ChatPage` — message bubbles + composer at the bottom. */
export function ChatPageSkeleton() {
  return (
    <div className="flex flex-1 flex-col bg-muted/20" role="status" aria-label="Loading chat">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
        <ShimmerBlock className="h-5 w-40" />
        <ShimmerBlock className="h-8 w-32 rounded-md" />
      </div>
      <div className="flex flex-1 flex-col gap-4 overflow-hidden p-6">
        <div className="flex justify-end">
          <ShimmerBlock className="h-12 w-1/3 rounded-2xl" />
        </div>
        <div className="flex">
          <ShimmerBlock className="h-20 w-2/3 rounded-2xl" />
        </div>
        <div className="flex justify-end">
          <ShimmerBlock className="h-10 w-1/4 rounded-2xl" />
        </div>
        <div className="flex">
          <ShimmerBlock className="h-16 w-1/2 rounded-2xl" />
        </div>
      </div>
      <div className="border-t border-border bg-background p-4">
        <ShimmerBlock className="h-12 w-full rounded-xl" />
      </div>
    </div>
  );
}
