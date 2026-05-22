'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search } from './ui/icons';

import { newFile } from '../admin/actions';
import { useConfig } from '../hooks/useConfig';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { StatusBadge } from './StatusBadge';
import { toast } from '../hooks/useToast';
import { useFileState } from '../hooks/useFileState';
import { EntryListItem } from '../types';

type ContentTypesProps = {
  entries: EntryListItem[];
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60_000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const ContentTypes = ({ entries = [] }: ContentTypesProps) => {
  const config = useConfig();
  const { selectedType, onFileClick } = useFileState();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);

  const filteredEntries = useMemo(() => {
    let result = selectedType ? entries.filter((entry) => entry.type === selectedType) : [];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    return result;
  }, [entries, selectedType, search]);

  const addNew = async () => {
    if (!selectedType) return;
    setCreating(true);
    try {
      const result = await newFile(selectedType);
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }
      const path = result.path;
      const parts = path.replace(`${config.contentFolder}/`, '').replace('.json', '').split('/');
      const file = { type: parts[0], id: parts[parts.length - 1], path };
      onFileClick(file);
      router.push(`/cms/content/${file.type}/${file.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="octo-page-shell">
      {/* Header */}
      <div className="octo-page-chrome">
        <h1 className="octo-page-chrome__title octo-u-text-xl">
          {selectedType
            ? (config.collections[selectedType as keyof typeof config.collections]?.label ?? selectedType)
            : 'Entries'}
        </h1>
        {selectedType && (
          <Button size="sm" variant="default" onClick={addNew} disabled={creating}>
            <Plus className="octo-icon-md" />
            Add entry
          </Button>
        )}
      </div>

      <div className="octo-content-types__body">
        {/* Search bar */}
        <div className="octo-content-types__toolbar">
          <div className="octo-content-search octo-content-types__search-wrap">
            <Search className="octo-content-search__icon octo-icon-md" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter entries…"
              className="octo-search-input--icon-padded"
            />
          </div>
        </div>

        {/* Table */}
        <div className="octo-content-types__table-wrap">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="octo-table-head--muted">Name</TableHead>
                <TableHead className="octo-table-head--muted">Updated</TableHead>
                <TableHead className="octo-table-head--muted">Status</TableHead>
                <TableHead style={{ width: 40 }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="octo-content-types__empty">
                    No entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow
                    key={entry.path}
                    className={cn('octo-content-row', entry.status === 'archived' && 'octo-content-row--archived')}
                    onClick={() => {
                      onFileClick(entry);
                      router.push(`/cms/content/${entry.type}/${entry.id}`);
                    }}
                  >
                    <TableCell className="octo-u-font-medium">{entry.title}</TableCell>
                    <TableCell className="octo-u-text-muted">
                      {entry.updatedAt ? relativeTime(entry.updatedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" disabled onClick={(e) => e.stopPropagation()}>
                        <MoreHorizontal className="octo-icon-md octo-u-text-muted" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default ContentTypes;
