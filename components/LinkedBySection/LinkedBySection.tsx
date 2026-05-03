'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Link2 } from 'lucide-react';
import React, { useEffect } from 'react';

import { useEntryBacklinks } from '../../admin/query/hooks/useEntryBacklinks';
import { queryKeys } from '../../admin/query/keys';
import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryStack } from '../../hooks/useEntryStack';
import { toReferenceKey } from '../../lib/referenceKeys';

type LinkedBySectionProps = {
  entryPath: string;
};

const LinkedBySection = ({ entryPath }: LinkedBySectionProps) => {
  const config = useConfig();
  const { pushEntry, refreshTick } = useEntryStack();
  const queryClient = useQueryClient();

  const referenceKey = toReferenceKey(entryPath);
  const backlinksQuery = useEntryBacklinks(referenceKey);

  useEffect(() => {
    if (refreshTick === 0) return;
    void queryClient.invalidateQueries({ queryKey: queryKeys.entries.backlinks(referenceKey) });
  }, [refreshTick, referenceKey, queryClient]);

  const backlinks = backlinksQuery.data ?? [];
  const isLoading = backlinksQuery.isPending && backlinksQuery.data === undefined;

  if (isLoading) {
    return (
      <div>
        <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Links</div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (backlinks.length === 0) return null;

  return (
    <div>
      <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Links</div>
      <p className="text-sm text-muted-foreground mb-2">
        {backlinks.length === 1 ? '1 entry links' : `${backlinks.length} entries link`} to this entry:
      </p>
      <ul className="space-y-1">
        {backlinks.map((link) => {
          const linkCollectionLabel = config.collections[link.type as keyof Config['collections']]?.label || link.type;
          return (
            <li key={link.path}>
              <button
                type="button"
                onClick={() =>
                  pushEntry({
                    id: link.id,
                    type: link.type,
                    path: link.path,
                    title: link.title,
                  })
                }
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors group"
              >
                <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate group-hover:text-primary">{link.title}</div>
                  <div className="text-xs text-muted-foreground">{linkCollectionLabel}</div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default LinkedBySection;
