'use client';

import * as React from 'react';
import { GitBranch, GitPullRequest } from 'lucide-react';

import { Button } from '../ui/button';
import { useRecentCMSPullRequests } from '../../admin/query/hooks/useRecentCMSPullRequests';
import { cn } from '../../lib/utils';
import type { RecentCMSPullRequest } from '../../admin/actions/git';

/**
 * Recent CMS pull requests view — mounted by `DashboardContent` when
 * `/cms?tab=recent` is active. Lists the most-recently-updated PRs labelled
 * `cms-update` across open / merged / closed states.
 */
export function RecentPullRequestsView() {
  const recentPRsQ = useRecentCMSPullRequests();
  const recentPRs = recentPRsQ.data ?? [];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <div className="scroll flex-1 overflow-auto px-6 pb-12 pt-5">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-[14px] font-semibold">Recent pull requests</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              Latest <code className="font-mono">cms-update</code> PRs · open and merged
            </p>
          </div>
          {recentPRsQ.isPending && !recentPRsQ.data ? (
            <RecentPullRequestsSkeleton />
          ) : recentPRs.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
              {recentPRs.map((pr, i) => (
                <PullRequestRow key={pr.prNumber} pr={pr} isLast={i === recentPRs.length - 1} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PullRequestRow({ pr, isLast }: { pr: RecentCMSPullRequest; isLast: boolean }) {
  // Tile color reflects state — open uses brand, merged uses the merged status
  // tokens, closed-without-merge dims to the muted surface.
  const tileClass =
    pr.state === 'merged'
      ? 'border-[var(--st-merged-bd)] bg-[var(--st-merged-bg)] text-[var(--st-merged)]'
      : pr.state === 'closed'
        ? 'border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]'
        : 'border-[var(--brand)] bg-[var(--brand-bg)] text-[var(--brand-strong)]';
  return (
    <div className={cn('flex items-center gap-3.5 px-4 py-3.5', !isLast && 'border-b border-[var(--border)]')}>
      <span className={cn('grid h-7 w-7 flex-none place-items-center rounded-md border', tileClass)}>
        <GitPullRequest size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold">{pr.title}</div>
        <div className="mt-0.5 flex items-center gap-2.5 font-mono text-[12px] text-[var(--muted)]">
          <span className="inline-flex items-center gap-1">
            <GitBranch size={10} />
            {pr.branch} → main
          </span>
          <PRStateBadge state={pr.state} />
          {pr.updatedAt ? <span>· {compactRelativeTime(pr.updatedAt)}</span> : null}
        </div>
      </div>
      <Button asChild variant="secondary" size="sm">
        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer">
          {pr.state === 'open' ? 'Review' : 'View'}
        </a>
      </Button>
    </div>
  );
}

function PRStateBadge({ state }: { state: RecentCMSPullRequest['state'] }) {
  const cfg =
    state === 'merged'
      ? { label: 'Merged', cls: 'bg-[var(--st-merged-bg)] text-[var(--st-merged)] border-[var(--st-merged-bd)]' }
      : state === 'closed'
        ? { label: 'Closed', cls: 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]' }
        : { label: 'Open', cls: 'bg-[var(--brand-bg)] text-[var(--brand-strong)] border-[var(--brand)]' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 font-mono text-[10px] font-semibold leading-4',
        cfg.cls,
      )}
    >
      {cfg.label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--surface-2)]">
        <GitPullRequest className="h-5 w-5 text-[var(--muted)]" />
      </div>
      <p className="text-sm font-medium text-[var(--text)]">No CMS pull requests yet</p>
      <p className="max-w-xs text-sm text-[var(--muted)]">
        Pull requests labelled <code className="font-mono">cms-update</code> will show up here as they're opened.
      </p>
    </div>
  );
}

function RecentPullRequestsSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-1)]">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 border-b border-[var(--border)] px-4 py-3.5 last:border-b-0">
          <div className="h-7 w-7 flex-none rounded-md bg-[var(--surface-2)]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-1/2 rounded bg-[var(--surface-2)]" />
            <div className="h-2.5 w-2/3 rounded bg-[var(--surface-2)]" />
          </div>
          <div className="h-7 w-16 rounded-full bg-[var(--surface-2)]" />
        </div>
      ))}
    </div>
  );
}

function compactRelativeTime(iso: string): string {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return '—';
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
