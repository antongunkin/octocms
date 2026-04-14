'use client';

import { Link2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';

import { getEntryBacklinks } from '../../admin/actions';
import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryStack } from '../../hooks/useEntryStack';
import type { EntryListItem } from '../../types';
import { toReferenceKey } from '../../lib/referenceKeys';

type LinkedBySectionProps = {
  entryPath: string;
};

const LinkedBySection = ({ entryPath }: LinkedBySectionProps) => {
  const config = useConfig();
  const [backlinks, setBacklinks] = useState<EntryListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { pushEntry } = useEntryStack();

  // Derive the reference key for this entry (e.g. 'author-abc.json')
  const referenceKey = toReferenceKey(entryPath);

  useEffect(() => {
    const load = async () => {
      try {
        const links = await getEntryBacklinks(referenceKey);
        setBacklinks(links);
      } catch (_e) {
        // Silently fail
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [referenceKey]);

  // Refresh backlinks when entries are saved or deleted
  useEffect(() => {
    const handler = () => {
      getEntryBacklinks(referenceKey)
        .then(setBacklinks)
        .catch(() => {});
    };
    window.addEventListener('cms:entry-saved', handler);
    window.addEventListener('cms:entry-deleted', handler);
    return () => {
      window.removeEventListener('cms:entry-saved', handler);
      window.removeEventListener('cms:entry-deleted', handler);
    };
  }, [referenceKey]);

  if (isLoading) {
    return (
      <div className="border-t border-[rgb(231,235,238)] pt-4 mt-2">
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Links</div>
        <div className="text-sm text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (backlinks.length === 0) return null;

  return (
    <div className="border-t border-[rgb(231,235,238)] pt-4 mt-2">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Links</div>
      <p className="text-sm text-muted-foreground mb-2">
        There {backlinks.length === 1 ? 'is' : 'are'} {backlinks.length} other{' '}
        {backlinks.length === 1 ? 'entry' : 'entries'} that link to this entry:
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
