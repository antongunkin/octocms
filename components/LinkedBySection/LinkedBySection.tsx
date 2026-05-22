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
      <div className="octo-linked-by">
        <div className="octo-linked-by__title">Links</div>
        <div className="octo-linked-by__loading">Loading...</div>
      </div>
    );
  }

  if (backlinks.length === 0) return null;

  return (
    <div className="octo-linked-by">
      <div className="octo-linked-by__title">Links</div>
      <p className="octo-linked-by__summary">
        {backlinks.length === 1 ? '1 entry links' : `${backlinks.length} entries link`} to this entry:
      </p>
      <ul className="octo-linked-by__list">
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
                className="octo-linked-by__item"
              >
                <Link2 className="octo-linked-by__item-icon" />
                <div className="octo-linked-by__item-body">
                  <div className="octo-linked-by__item-title">{link.title}</div>
                  <div className="octo-linked-by__item-type">{linkCollectionLabel}</div>
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
