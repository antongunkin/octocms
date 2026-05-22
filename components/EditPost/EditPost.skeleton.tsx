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
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-7 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-5 octo-skel-w-64" />
          <ShimmerBlock className="octo-skel-h-5 octo-skel-w-16 octo-skel-rounded-full" />
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-24 octo-skel-rounded-md" />
        </div>
      </div>
      <div className="octo-edit-post__body">
        <div className="octo-edit-post__form-col">
          <div className="octo-edit-post__form-wrap">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <ShimmerBlock style={{ height: 14, width: 96 }} />
                  <ShimmerBlock style={{ height: i === 4 ? 160 : 36, width: '100%' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="octo-edit-post__sidebar">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="octo-card" style={{ padding: '16px' }}>
              <ShimmerBlock className="octo-skel-mb-3 octo-skel-h-4 octo-skel-w-24" />
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-full" />
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-2-3" style={{ marginTop: 8 }} />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
