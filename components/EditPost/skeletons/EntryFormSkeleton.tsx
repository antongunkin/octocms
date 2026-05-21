import React from 'react';

import { FormFieldSkeleton } from '../../skeletons/blocks';

/**
 * Form-pane placeholder used while `useEntry` resolves. Mirrors the
 * 6-field column layout of the typical entry editor.
 */
export function EntryFormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <section role="status" aria-label="Loading entry fields" className="octo-edit-post__form-card">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Array.from({ length: fields }, (_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
