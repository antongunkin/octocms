'use client';

import { useRouter } from 'next/navigation';
import React, { useMemo, useState } from 'react';
import { MoreHorizontal, Plus, Search } from 'lucide-react';

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
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">
          {selectedType
            ? (config.collections[selectedType as keyof typeof config.collections]?.label ?? selectedType)
            : 'Entries'}
        </h1>
        {selectedType && (
          <Button
            size="sm"
            className="gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
            onClick={addNew}
            disabled={creating}
          >
            <Plus className="h-4 w-4" />
            Add entry
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col overflow-hidden p-6">
        {/* Search bar */}
        <div className="mb-4 flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter entries…"
              className="pl-9"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto rounded-lg border border-border bg-background">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="font-medium text-muted-foreground">Updated</TableHead>
                <TableHead className="font-medium text-muted-foreground">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEntries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                    No entries found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEntries.map((entry) => (
                  <TableRow
                    key={entry.path}
                    className={cn('cursor-pointer', entry.status === 'archived' && 'opacity-60')}
                    onClick={() => {
                      onFileClick(entry);
                      router.push(`/cms/content/${entry.type}/${entry.id}`);
                    }}
                  >
                    <TableCell className="font-medium">{entry.title}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {entry.updatedAt ? relativeTime(entry.updatedAt) : '—'}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={entry.status} />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
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
