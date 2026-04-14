import React, { Suspense } from 'react';
import { getServerSession } from 'next-auth';

import SearchPageComponent from '../../components/SearchPage';
import { authOptions } from '../auth';

export function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageContent />
    </Suspense>
  );
}

async function SearchPageContent() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return <SearchPageComponent />;
}
