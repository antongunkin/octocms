import React from 'react';
import { getServerSession } from 'next-auth';

import { getConfig } from '../../lib/configStore';
import { authOptions } from '../auth';
import DashboardContent from '../../components/Dashboard/DashboardContent';
import { getEntryList, hasActiveBranch } from '../actions';
import { getBranch } from '../actions/git';

export async function ContentPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  const [entries, hasBranch, activeBranch] = await Promise.all([getEntryList(), hasActiveBranch(), getBranch()]);
  const collections = Object.keys(getConfig().collections);

  return (
    <DashboardContent entries={entries} collections={collections} hasBranch={hasBranch} activeBranch={activeBranch} />
  );
}
