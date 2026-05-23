import React from 'react';
import dynamic from 'next/dynamic';
import { getServerSession } from 'next-auth';

import { DashboardContentSkeleton } from '../../components/Dashboard/DashboardContent.skeleton';
import { authOptions } from '../auth';

const DashboardContent = dynamic(() => import('../../components/Dashboard/DashboardContent'), {
  loading: () => <DashboardContentSkeleton />,
});

export async function ContentPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return <DashboardContent />;
}
