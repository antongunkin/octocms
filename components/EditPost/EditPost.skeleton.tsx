import React from 'react';

import { ShimmerBlock } from '../skeletons/primitives';

/**
 * Mirrors `EditPost` — header row, two-column form + sidebar with cards.
 */
export function EditPostSkeleton() {
  return (
    <div className="octo-edit-post" role="status" aria-label="Loading entry">
      <div className="octo-page-chrome">
        <div className="octo-skel-row-12">
          <ShimmerBlock className="octo-skel-h-7 octo-skel-w-7 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-5 octo-skel-w-64" />
          <ShimmerBlock className="octo-skel-h-5 octo-skel-w-16 octo-skel-rounded-full" />
        </div>
        <div className="octo-skel-row-gap-8">
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-20 octo-skel-rounded-md" />
          <ShimmerBlock className="octo-skel-h-8 octo-skel-w-24 octo-skel-rounded-md" />
        </div>
      </div>
      <div className="octo-edit-post__body">
        <div className="octo-edit-post__form-col">
          <div className="octo-edit-post__form-wrap">
            <div className="octo-edit-post__form-skel">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="octo-skel-col-8">
                  <ShimmerBlock className="octo-edit-post__skel-label" />
                  <ShimmerBlock style={{ height: i === 4 ? 160 : 36, width: '100%' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
        <aside className="octo-edit-post__sidebar">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="octo-card octo-edit-post__skel-card">
              <ShimmerBlock className="octo-skel-mb-3 octo-skel-h-4 octo-skel-w-24" />
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-full" />
              <ShimmerBlock className="octo-skel-h-3 octo-skel-w-2-3 octo-edit-post__skel-mt" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
