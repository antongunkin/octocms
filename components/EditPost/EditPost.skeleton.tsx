import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/**
 * Mirrors `EditPost` — header row, two-column form + sidebar with cards.
 */
export function EditPostSkeleton() {
  return (
    <div className="octo-edit-post" role="status" aria-label="Loading entry">
      <div className="octo-page-chrome">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <ShimmerBlock className="h-7 w-7 rounded-md" />
          <ShimmerBlock className="h-5 w-64" />
          <ShimmerBlock className="h-5 w-16 rounded-full" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShimmerBlock className="h-8 w-20 rounded-md" />
          <ShimmerBlock className="h-8 w-20 rounded-md" />
          <ShimmerBlock className="h-8 w-24 rounded-md" />
        </div>
      </div>
      <div className="octo-edit-post__body">
        <div className="octo-edit-post__form-col">
          <div className="octo-edit-post__form-wrap">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ShimmerBlock className="h-3.5 w-24" />
                  <ShimmerBlock className={i === 4 ? 'h-40 w-full' : 'h-9 w-full'} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="octo-edit-post__sidebar">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="octo-card" style={{ padding: '16px' }}>
              <ShimmerBlock className="mb-3 h-4 w-24" />
              <ShimmerBlock className="h-3 w-full" />
              <ShimmerBlock className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
