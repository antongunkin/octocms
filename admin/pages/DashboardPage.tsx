import React, { Suspense } from 'react';
import { getServerSession } from 'next-auth';

import { getConfig } from '../../lib/configStore';
import { authOptions } from '../auth';
import DashboardContent from '../../components/Dashboard/DashboardContent';
import { CMSSidebar } from '../../components/CMSSidebar/CMSSidebar';
import { getEntryList, hasActiveBranch } from '../actions';

export function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardPageContent />
    </Suspense>
  );
}

async function DashboardPageContent() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const [entries, hasBranch] = await Promise.all([getEntryList(), hasActiveBranch()]);
  const collections = Object.keys(getConfig().collections);

  return (
    <>
      <CMSSidebar />
      <DashboardContent entries={entries} collections={collections} hasBranch={hasBranch} />
    </>
  );
}
