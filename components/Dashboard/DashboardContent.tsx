'use client';

import React, { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
} from 'lucide-react';

import { newFile } from '../../admin/actions';
import { useConfig } from '../../hooks/useConfig';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { StatusBadge } from '../StatusBadge';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { relativeTime } from '../../lib/relativeTime';
import type { EntryListItem, EntryStatus } from '../../types';

const PAGE_SIZE = 20;

const ALL_STATUSES: EntryStatus[] = ['draft', 'changed', 'published', 'merged', 'archived'];

type Props = {
  entries: EntryListItem[];
  collections: string[];
  hasBranch: boolean;
};

export default function DashboardContent({ entries, collections, hasBranch }: Props) {
  const config = useConfig();
  const searchParams = useSearchParams();
  const isBranched = searchParams.get('tab') === 'branched';

  const hasManyCollections = collections.filter(
    (c) => config.collections[c as keyof typeof config.collections]?.hasMany,
  );

  const branchedEntries = useMemo(() => entries.filter((e) => e.status !== 'merged'), [entries]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-muted/20">
      {/* Page header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">{isBranched ? 'Branched content' : 'All content'}</h1>
        <AddEntryButton collections={hasManyCollections} />
      </div>

      {isBranched ? (
        <BranchedView entries={branchedEntries} collections={collections} hasBranch={hasBranch} />
      ) : (
        <ContentTable entries={entries} collections={collections} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add entry button / dropdown
// ---------------------------------------------------------------------------

function AddEntryButton({ collections }: { collections: string[] }) {
  const config = useConfig();
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreate(type: string) {
    setCreating(true);
    try {
      const result = await newFile(type);
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }
      const parts = result.path.replace(`${config.contentFolder}/`, '').replace('.json', '').split('/');
      router.push(`/cms/${parts[0]}/${parts[parts.length - 1]}`);
    } finally {
      setCreating(false);
    }
  }

  if (collections.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-blue-600 text-white hover:bg-blue-700" disabled={creating}>
          <Plus className="h-4 w-4" />
          Add entry
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {collections.map((c) => (
          <DropdownMenuItem key={c} onSelect={() => handleCreate(c)}>
            <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
            {config.collections[c as keyof typeof config.collections]?.label ?? c}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// All content table
// ---------------------------------------------------------------------------

function ContentTable({ entries, collections }: { entries: EntryListItem[]; collections: string[] }) {
  const config = useConfig();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('any');
  const [statusFilter, setStatusFilter] = useState('any');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    let result = entries;
    if (typeFilter !== 'any') result = result.filter((e) => e.type === typeFilter);
    if (statusFilter !== 'any') result = result.filter((e) => e.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter((e) => e.title.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => {
      if (!a.updatedAt && !b.updatedAt) return 0;
      if (!a.updatedAt) return 1;
      if (!b.updatedAt) return -1;
      const diff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      return sortOrder === 'newest' ? diff : -diff;
    });
    return result;
  }, [entries, typeFilter, statusFilter, search, sortOrder]);

  const prevFiltersRef = React.useRef({ search, typeFilter, statusFilter, sortOrder });
  React.useEffect(() => {
    const prev = prevFiltersRef.current;
    if (
      prev.search !== search ||
      prev.typeFilter !== typeFilter ||
      prev.statusFilter !== statusFilter ||
      prev.sortOrder !== sortOrder
    ) {
      setPage(0);
      prevFiltersRef.current = { search, typeFilter, statusFilter, sortOrder };
    }
  }, [search, typeFilter, statusFilter, sortOrder]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-6">
      {/* Filter bar */}
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Content type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any type</SelectItem>
            {collections.map((c) => (
              <SelectItem key={c} value={c}>
                {config.collections[c as keyof typeof config.collections]?.label ?? c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Any status</SelectItem>
            {ALL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto rounded-lg border border-border bg-background">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-medium text-muted-foreground">Name</TableHead>
              <TableHead className="font-medium text-muted-foreground">Content Type</TableHead>
              <TableHead className="font-medium text-muted-foreground">Updated</TableHead>
              <TableHead className="font-medium text-muted-foreground">Author</TableHead>
              <TableHead className="font-medium text-muted-foreground">Status</TableHead>
              <TableHead className="w-10">
                <Button variant="ghost" size="icon" className="h-7 w-7" disabled>
                  <Settings className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                  No entries found.
                </TableCell>
              </TableRow>
            ) : (
              pageItems.map((entry) => (
                <EntryRow
                  key={entry.path}
                  entry={entry}
                  onClick={() => router.push(`/cms/${entry.type}/${entry.id}`)}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'entry' : 'entries'}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          {totalPages > 1 && (
            <span className="px-3 text-sm text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Branched content view
// ---------------------------------------------------------------------------

function BranchedView({
  entries,
  collections,
  hasBranch,
}: {
  entries: EntryListItem[];
  collections: string[];
  hasBranch: boolean;
}) {
  if (!hasBranch) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No active branch</p>
          <p className="max-w-xs text-sm text-muted-foreground">
            Create a branch to start tracking content changes separately from the main branch.
          </p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">No changes on this branch yet</p>
          <p className="text-sm text-muted-foreground">Edits you make will appear here.</p>
        </div>
      </div>
    );
  }

  return <ContentTable entries={entries} collections={collections} />;
}

// ---------------------------------------------------------------------------
// Shared entry row
// ---------------------------------------------------------------------------

function EntryRow({ entry, onClick }: { entry: EntryListItem; onClick: () => void }) {
  const config = useConfig();
  return (
    <TableRow className={cn('cursor-pointer', entry.status === 'archived' && 'opacity-60')} onClick={onClick}>
      <TableCell className="font-medium">{entry.title}</TableCell>
      <TableCell className="text-muted-foreground">
        {config.collections[entry.type as keyof typeof config.collections]?.label ?? entry.type}
      </TableCell>
      <TableCell className="text-muted-foreground">{entry.updatedAt ? relativeTime(entry.updatedAt) : '—'}</TableCell>
      <TableCell className="text-muted-foreground">—</TableCell>
      <TableCell>
        <StatusBadge status={entry.status} />
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
