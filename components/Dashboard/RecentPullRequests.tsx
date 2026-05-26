'use client';

import * as React from 'react';
import { Button, Icon } from '../ui';

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
    <>
      <h2 className="octo-pr-list__heading">Recent pull requests</h2>
      <p className="octo-pr-list__sub">
        Latest <code className="octo-u-mono">cms-update</code> PRs · open and merged
      </p>
      {recentPRsQ.isPending && !recentPRsQ.data ? (
        <RecentPullRequestsSkeleton />
      ) : recentPRs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="octo-pr-list__card">
          {recentPRs.map((pr, i) => (
            <PullRequestRow key={pr.prNumber} pr={pr} isLast={i === recentPRs.length - 1} />
          ))}
        </div>
      )}
    </>
  );
}

function PullRequestRow({ pr, isLast: _isLast }: { pr: RecentCMSPullRequest; isLast: boolean }) {
  const tileVariant =
    pr.state === 'merged'
      ? 'octo-pr-row__tile octo-pr-row__tile--merged'
      : pr.state === 'closed'
        ? 'octo-pr-row__tile octo-pr-row__tile--closed'
        : 'octo-pr-row__tile octo-pr-row__tile--open';
  return (
    <div className="octo-pr-row">
      <span className={cn('octo-pr-row__tile', tileVariant)}>
        <Icon.GitPullRequest size={13} />
      </span>
      <div className="octo-pr-row__body">
        <div className="octo-pr-row__title">{pr.title}</div>
        <div className="octo-pr-row__meta">
          <span className="octo-pr-row__branch">
            <Icon.GitBranch size={10} />
            {pr.branch} → main
          </span>
          <PRStateBadge state={pr.state} />
          {pr.updatedAt ? <span>· {compactRelativeTime(pr.updatedAt)}</span> : null}
        </div>
      </div>
      <Button asChild variant="secondary">
        <a href={pr.prUrl} target="_blank" rel="noopener noreferrer">
          {pr.state === 'open' ? 'Review' : 'View'}
        </a>
      </Button>
    </div>
  );
}

function PRStateBadge({ state }: { state: RecentCMSPullRequest['state'] }) {
  const { label, variant } =
    state === 'merged'
      ? { label: 'Merged', variant: 'octo-pr-badge octo-pr-badge--merged' }
      : state === 'closed'
        ? { label: 'Closed', variant: 'octo-pr-badge octo-pr-badge--closed' }
        : { label: 'Open', variant: 'octo-pr-badge octo-pr-badge--open' };
  return <span className={cn('octo-pr-badge', variant)}>{label}</span>;
}

function EmptyState() {
  return (
    <div className="octo-pr-empty">
      <div className="octo-pr-empty__icon">
        <Icon.GitPullRequest className="octo-icon-lg" />
      </div>
      <p className="octo-pr-empty__title">No CMS pull requests yet</p>
      <p className="octo-pr-empty__text">
        Pull requests labelled <code className="octo-u-mono">cms-update</code> will show up here as they're opened.
      </p>
    </div>
  );
}

function RecentPullRequestsSkeleton() {
  return (
    <div className="octo-pr-list__card">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="octo-pr-skel__row">
          <div className="octo-pr-skel__tile" />
          <div className="octo-pr-skel__lines">
            <div className="octo-pr-skel__line octo-pr-skel__line--primary" />
            <div className="octo-pr-skel__line octo-pr-skel__line--secondary" />
          </div>
          <div className="octo-pr-skel__btn" />
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
