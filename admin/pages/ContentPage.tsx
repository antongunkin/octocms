import React from 'react';
import dynamic from 'next/dynamic';
import { getCmsSession } from '../auth/session';

import { DashboardPageSkeleton } from '../../components/Dashboard/skeletons/DashboardPageSkeleton';

const DashboardContent = dynamic(() => import('../../components/Dashboard/DashboardContent'), {
  loading: () => <DashboardPageSkeleton />,
});

export async function ContentPage() {
  const session = await getCmsSession();

  if (!session) {
    return null;
  }

  return <DashboardContent />;
}
