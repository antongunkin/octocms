'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { relativeTime } from '../../lib/relativeTime';
import type { EntryCommit } from '../../types';

type HistorySectionProps = {
  entryPath: string;
};

type Status = 'idle' | 'loading' | 'ready' | 'error';

const HistorySection = ({ entryPath }: HistorySectionProps) => {
  const [commits, setCommits] = useState<EntryCommit[]>([]);
  const [seeAllUrl, setSeeAllUrl] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const rootRef = useRef<HTMLDivElement | null>(null);
  const statusRef = useRef<Status>('idle');

  statusRef.current = status;

  // Fetch is defined in a stable ref so event listeners can call the latest version.
  const fetchRef = useRef<() => Promise<void>>(async () => {});
  fetchRef.current = async () => {
    if (!entryPath) return;
    setStatus((s) => (s === 'ready' ? 'ready' : 'loading'));
    try {
      const { getEntryCommits } = await import('../../admin/actions');
      const result = await getEntryCommits(entryPath);
      setCommits(result.commits);
      setSeeAllUrl(result.seeAllUrl);
      setStatus('ready');
    } catch (_e) {
      setStatus('error');
    }
  };

  // Layer B: defer the network call until the card enters the viewport.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    if (typeof IntersectionObserver === 'undefined') {
      // Fallback for environments without IO: fire immediately after mount.
      fetchRef.current();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            observer.disconnect();
            fetchRef.current();
            break;
          }
        }
      },
      { rootMargin: '0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [entryPath]);

  // Refetch on entry-saved/deleted, but only if we already fetched once
  // (don't force a pre-view fetch).
  useEffect(() => {
    const handler = () => {
      if (statusRef.current !== 'idle') {
        fetchRef.current();
      }
    };
    window.addEventListener('cms:entry-saved', handler);
    window.addEventListener('cms:entry-deleted', handler);
    return () => {
      window.removeEventListener('cms:entry-saved', handler);
      window.removeEventListener('cms:entry-deleted', handler);
    };
  }, []);

  const isIdleOrLoading = status === 'idle' || status === 'loading';
  const isEmpty = (status === 'ready' && commits.length === 0) || status === 'error';

  return (
    <Card ref={rootRef}>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardContent>
        {isIdleOrLoading && (
          <div className="space-y-2" data-testid="history-skeleton">
            <div className="h-8 rounded bg-muted/40" />
            <div className="h-8 rounded bg-muted/40" />
            <div className="h-8 rounded bg-muted/40" />
          </div>
        )}
        {isEmpty && <p className="text-sm text-muted-foreground">No commits yet.</p>}
        {status === 'ready' && commits.length > 0 && (
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
        {status === 'ready' && seeAllUrl && (
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
      </CardContent>
    </Card>
  );
};

export default HistorySection;
