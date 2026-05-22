'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from '../ui/icons';

import { useEntryCommits } from '../../admin/query/hooks/useEntryCommits';
import { queryKeys } from '../../admin/query/keys';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useEntryStack } from '../../hooks/useEntryStack';
import { relativeTime } from '../../lib/relativeTime';

type HistorySectionProps = {
  entryPath: string;
  flat?: boolean;
};

const HistorySection = ({ entryPath, flat }: HistorySectionProps) => {
  const [commitsEnabled, setCommitsEnabled] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { refreshTick } = useEntryStack();
  const queryClient = useQueryClient();

  const commitsQuery = useEntryCommits(entryPath, { enabled: commitsEnabled && Boolean(entryPath) });

  // Layer B: enable the query only after the card enters the viewport.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      setCommitsEnabled(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            setCommitsEnabled(true);
            break;
          }
        }
      },
      { rootMargin: '0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entryPath]);

  // Refetch when an inline-edit overlay closes after a save/delete — but only if we
  // already enabled the query (preserves the "don't pre-fetch before intersection" rule).
  useEffect(() => {
    if (refreshTick === 0) return;
    if (!commitsEnabled) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.entries.commits(entryPath) });
  }, [refreshTick, commitsEnabled, entryPath, queryClient]);

  const commits = commitsQuery.data?.commits ?? [];
  const seeAllUrl = commitsQuery.data?.seeAllUrl ?? '';

  const showSkeleton = !commitsEnabled || (commitsQuery.isPending && commitsQuery.data === undefined);
  const showEmpty =
    commitsEnabled &&
    !commitsQuery.isPending &&
    (commitsQuery.isError || (commitsQuery.isSuccess && commits.length === 0));
  const showList = commitsEnabled && commitsQuery.isSuccess && commits.length > 0;
  const showSeeAll = commitsEnabled && commitsQuery.isSuccess && Boolean(seeAllUrl);

  const body = (
    <>
      {showSkeleton && (
        <div className="octo-history__skeleton" data-testid="history-skeleton">
          <div className="octo-history__skeleton-row" />
          <div className="octo-history__skeleton-row" />
          <div className="octo-history__skeleton-row" />
        </div>
      )}
      {showEmpty && <p className="octo-history__empty">No commits yet.</p>}
      {showList && (
        <ul className="octo-history__list">
          {commits.map((c) => (
            <li key={c.sha}>
              <a href={c.url} target="_blank" rel="noreferrer" className="octo-history__item">
                <div className="octo-history__msg" title={c.message}>
                  {c.message}
                </div>
                <div className="octo-history__meta">
                  {c.author.name} · {relativeTime(c.committedAt)} ·{' '}
                  <code className="octo-history__sha">{c.shortSha}</code>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      {showSeeAll && (
        <a href={seeAllUrl} target="_blank" rel="noreferrer" className="octo-history__see-all">
          See all commits
          <ExternalLink className="octo-icon-xs" />
        </a>
      )}
    </>
  );

  if (flat) {
    return (
      <div ref={rootRef} className="octo-history">
        <div className="octo-history__title">History</div>
        {body}
      </div>
    );
  }

  return (
    <Card ref={rootRef}>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};

export default HistorySection;
