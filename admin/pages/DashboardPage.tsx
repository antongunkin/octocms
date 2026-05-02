import React from 'react';
import { getServerSession } from 'next-auth';

import { authOptions } from '../auth';
// Dashboard home — sidebar belongs to ContentPage, not here.

export async function DashboardPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
      </div>
      <div className="flex flex-1 items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Dashboard coming soon.</p>
      </div>
    </div>
  );
}
