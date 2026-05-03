import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import React from 'react';

import DashboardContent from '../../components/Dashboard/DashboardContent';
import { getConfig } from '../../lib/configStore';
import { authOptions } from '../auth';

export async function CollectionPage({ params }: { params: Promise<{ type: string }> }) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const { type } = await params;
  const collections = Object.keys(getConfig().collections);

  if (!type) {
    redirect(`/cms/content`);
  }
  if (!collections.includes(type)) {
    redirect('/cms/content');
  }

  return <DashboardContent selectedType={type} />;
}
