import React from 'react';
import dynamic from 'next/dynamic';
import { getServerSession } from 'next-auth';

import { DashboardPageSkeleton } from '../../components/Dashboard/skeletons/DashboardPageSkeleton';
import { authOptions } from '../auth';

const DashboardContent = dynamic(() => import('../../components/Dashboard/DashboardContent'), {
  loading: () => <DashboardPageSkeleton />,
});

export async function ContentPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return <DashboardContent />;
}
