import React from 'react';

import { FormFieldSkeleton } from '../../skeletons/blocks';

/**
 * Form-pane placeholder used while `useEntry` resolves. Mirrors the
 * 6-field column layout of the typical entry editor.
 */
export function EntryFormSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <section
      role="status"
      aria-label="Loading entry fields"
      className="rounded-2xl border border-border bg-bg px-7 py-7 shadow-1"
    >
      <div className="flex flex-col gap-5">
        {Array.from({ length: fields }, (_, i) => (
          <FormFieldSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}
