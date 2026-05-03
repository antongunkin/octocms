import React from 'react';
import { getServerSession } from 'next-auth';

import DashboardContent from '../../components/Dashboard/DashboardContent';
import { authOptions } from '../auth';

export async function ContentPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return <DashboardContent />;
}
