'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';

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
        <div className="space-y-2" data-testid="history-skeleton">
          <div className="h-8 rounded bg-muted/40" />
          <div className="h-8 rounded bg-muted/40" />
          <div className="h-8 rounded bg-muted/40" />
        </div>
      )}
      {showEmpty && <p className="text-sm text-muted-foreground">No commits yet.</p>}
      {showList && (
        <ul className="space-y-2">
          {commits.map((c) => (
            <li key={c.sha}>
              <a
                href={c.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
              >
                <div className="text-sm font-medium text-foreground truncate" title={c.message}>
                  {c.message}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {c.author.name} · {relativeTime(c.committedAt)} ·{' '}
                  <code className="font-mono text-[11px]">{c.shortSha}</code>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
      {showSeeAll && (
        <a
          href={seeAllUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          See all commits
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </>
  );

  if (flat) {
    return (
      <div ref={rootRef}>
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          History
        </div>
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
