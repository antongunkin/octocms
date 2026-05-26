import React from 'react';

import { PageChromeSkeleton } from '../../Layout/skeletons/PageChromeSkeleton';

import { EntryFormSkeleton } from './EntryFormSkeleton';
import { EntrySidebarSkeleton } from './EntrySidebarSkeleton';

/** Full-page fallback for `/cms/content/<type>/<id>`. */
export function EditPostPageSkeleton() {
  return (
    <PageChromeSkeleton
      className="octo-edit-post"
      rightBar={<EntrySidebarSkeleton />}
      actionCount={3}
      ariaLabel="Loading entry"
    >
      <EntryFormSkeleton />
    </PageChromeSkeleton>
  );
}
