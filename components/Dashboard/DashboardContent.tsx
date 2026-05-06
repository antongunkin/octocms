'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { keepPreviousData } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  GitBranch,
  GitPullRequest,
  Image as ImageIcon,
  LayoutList,
  Plus,
  Search,
} from 'lucide-react';

import { useEntryList } from '../../admin/query/hooks/useEntryList';
import { useBranch } from '../../admin/query/hooks/useBranch';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
import { useNewFile } from '../../admin/query/hooks/useNewFile';
import { useConfig } from '../../hooks/useConfig';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { LeftNavItem } from '../Layout/LeftNavItem';
import { toast } from '../../hooks/useToast';
import { entryEditUrl } from '../../lib/entryEditUrl';
import { cn } from '../../lib/utils';
import type { EntryListItem, EntryStatus } from '../../types';
import { formatUpdatedAt, formatUpdatedAtFull } from '../../utils/formatUpdatedAt';

import { ContentTableSkeleton } from './skeletons/ContentTableSkeleton';
import { LeftPanelSkeleton } from './skeletons/LeftPanelSkeleton';
import { RecentPullRequestsView } from './RecentPullRequests';
import { useRecentCMSPullRequests } from '../../admin/query/hooks/useRecentCMSPullRequests';

const PAGE_SIZE = 20;
const ALL_STATUSES: EntryStatus[] = ['draft', 'changed', 'published', 'merged', 'archived'];

type Props = {
  selectedType?: string;
};

export default function DashboardContent({ selectedType }: Props) {
  const config = useConfig();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const isBranched = !selectedType && tabParam === 'branched';
  const isRecent = !selectedType && tabParam === 'recent';

  const entriesQuery = useEntryList(selectedType, { placeholderData: keepPreviousData });
  const branchQuery = useBranch();
  const hasActiveBranchQuery = useHasActiveBranch();
  // Always fetched so the LeftPanel can show the count badge; the hook is
  // shared with `RecentPullRequestsView` via the same query key (5 s staleTime).
  const recentPRsQuery = useRecentCMSPullRequests(5);
  const recentPRsCount = recentPRsQuery.data?.length ?? 0;

  const entriesData = entriesQuery.data;
  const isLoadingEntries = entriesQuery.isPending && !entriesData;
  const collections = Object.keys(config.collections);
  const activeBranch = branchQuery.data ?? '';
  const hasBranch = hasActiveBranchQuery.data ?? false;

  const selectedTypeLabel = selectedType
    ? (config.collections[selectedType as keyof typeof config.collections]?.label ?? selectedType)
    : null;

  const hasManyCollections = collections.filter(
    (c) => config.collections[c as keyof typeof config.collections]?.hasMany,
  );
  const addCollections = selectedType ? hasManyCollections.filter((c) => c === selectedType) : hasManyCollections;

  // Deps reference `entriesQuery.data` (stable identity from React Query) rather
  // than a freshly-created `data ?? []` so memoization works.
  const entries = useMemo<EntryListItem[]>(() => entriesData ?? [], [entriesData]);
  const visibleEntries = useMemo(
    () => (selectedType ? entries.filter((entry) => entry.type === selectedType) : entries),
    [entries, selectedType],
  );
  const branchedEntries = useMemo(() => entries.filter((e) => e.status !== 'merged'), [entries]);

  const countByType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const e of entries) {
      counts[e.type] = (counts[e.type] ?? 0) + 1;
    }
    return counts;
  }, [entries]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header */}
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-px flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <span style={{ color: 'var(--text-2)' }}>Content</span>
          </div>
          <div>
            <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em] text-foreground">
              {selectedTypeLabel ?? 'Content'}
            </h1>
          </div>
        </div>
        <div className="flex-none">
          <AddEntryButton collections={addCollections} />
        </div>
      </div>

      {/* Body: left nav + right content */}
      <div className="flex flex-1 overflow-hidden">
        {isLoadingEntries ? (
          <LeftPanelSkeleton />
        ) : (
          <LeftPanel
            entries={entries}
            branchedCount={branchedEntries.length}
            recentPRsCount={recentPRsCount}
            countByType={countByType}
            collections={collections}
            isBranched={isBranched}
            isRecent={isRecent}
            selectedType={selectedType}
          />
        )}

        {isLoadingEntries ? (
          <ContentTableSkeleton />
        ) : isRecent ? (
          <RecentPullRequestsView />
        ) : isBranched ? (
          <BranchedView
            entries={branchedEntries}
            collections={collections}
            hasBranch={hasBranch}
            activeBranch={activeBranch}
          />
        ) : (
          <ContentTable
            entries={visibleEntries}
            collections={collections}
            activeBranch={activeBranch}
            lockedType={selectedType}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add entry button / dropdown
// ---------------------------------------------------------------------------

function AddEntryButton({ collections }: { collections: string[] }) {
  const config = useConfig();
  const router = useRouter();
  const newFileMutation = useNewFile();

  async function handleCreate(type: string) {
    try {
      const result = await newFileMutation.mutateAsync(type);
      const parts = result.path.replace(`${config.contentFolder}/`, '').replace('.json', '').split('/');
      router.push(`/cms/content/${parts[0]}/${parts[parts.length - 1]}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Failed to create entry', variant: 'destructive' });
    }
  }
  const creating = newFileMutation.isPending;

  if (collections.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-1.5 bg-foreground text-background hover:bg-foreground/90" disabled={creating}>
          <Plus className="h-4 w-4" />
          Add content
          <ChevronDown className="h-3 w-3 opacity-70" />
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
// Left navigation panel
// ---------------------------------------------------------------------------

function LeftPanel({
  entries,
  branchedCount,
  recentPRsCount,
  countByType,
  collections,
  isBranched,
  isRecent,
  selectedType,
}: {
  entries: EntryListItem[];
  branchedCount: number;
  recentPRsCount: number;
  countByType: Record<string, number>;
  collections: string[];
  isBranched: boolean;
  isRecent: boolean;
  selectedType?: string;
}) {
  const config = useConfig();

  return (
    <aside className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--surface-2)]">
      <nav className="space-y-0.5 px-3 py-4">
        <LeftNavItem
          href="/cms"
          icon={<LayoutList className="h-4 w-4" />}
          label="All content"
          count={entries.length}
          active={!isBranched && !isRecent && !selectedType}
        />
        <LeftNavItem
          href="/cms?tab=branched"
          icon={<GitBranch className="h-4 w-4" />}
          label="Branched content"
          count={branchedCount}
          active={isBranched}
        />
        <LeftNavItem
          href="/cms?tab=recent"
          icon={<GitPullRequest className="h-4 w-4" />}
          label="Recent PRs"
          count={recentPRsCount}
          active={isRecent}
        />
      </nav>

      {collections.length > 0 && (
        <div className="px-3 pb-4 pt-1">
          <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Collections
          </p>
          <nav className="space-y-0.5">
            {collections.map((c) => {
              const label = config.collections[c as keyof typeof config.collections]?.label ?? c;
              return (
                <LeftNavItem
                  key={c}
                  href={`/cms/content/${c}`}
                  icon={<FileText className="h-4 w-4" />}
                  label={label}
                  count={countByType[c] ?? 0}
                  active={selectedType === c}
                />
              );
            })}
          </nav>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// All content table
// ---------------------------------------------------------------------------

function ContentTable({
  entries,
  collections,
  activeBranch,
  lockedType,
}: {
  entries: EntryListItem[];
  collections: string[];
  activeBranch: string;
  lockedType?: string;
}) {
  const config = useConfig();
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(lockedType ?? 'any');
  const [statusFilter, setStatusFilter] = useState('any');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [page, setPage] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    let result = entries;
    if (lockedType) {
      result = result.filter((e) => e.type === lockedType);
    } else if (typeFilter !== 'any') {
      result = result.filter((e) => e.type === typeFilter);
    }
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
  }, [entries, lockedType, typeFilter, statusFilter, search, sortOrder]);

  useEffect(() => {
    if (lockedType) setTypeFilter(lockedType);
  }, [lockedType]);

  const prevFiltersRef = useRef({ search, typeFilter, statusFilter, sortOrder });
  useEffect(() => {
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const startIdx = page * PAGE_SIZE + 1;
  const endIdx = Math.min((page + 1) * PAGE_SIZE, filtered.length);
  const baseBranch = config.git.baseBranch;

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[var(--bg)]">
      <div className="scroll flex-1 overflow-auto px-6 pb-12 pt-5">
        <div className="flex flex-col gap-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="relative min-w-[220px] flex-[0_1_420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter entries…"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                /
              </kbd>
            </div>
            {!lockedType && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-9 w-[130px] shrink-0 rounded-full border-border text-sm font-normal">
                  <SelectValue placeholder="Any type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any type</SelectItem>
                  {collections.map((collection) => (
                    <SelectItem key={collection} value={collection}>
                      {config.collections[collection as keyof typeof config.collections]?.label ?? collection}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[130px] shrink-0 rounded-full border-border text-sm font-normal">
                <SelectValue placeholder="Any status" />
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
            <div className="ml-auto shrink-0">
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
                <SelectTrigger className="h-9 w-[138px] rounded-full border-border text-sm font-normal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-[var(--surface-1)] shadow-[var(--shadow-1)]">
            <div className="overflow-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-[var(--surface-2)]">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Title
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Type
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Branch
                    </th>
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Updated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                        No entries found.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((entry) => (
                      <EntryRow
                        key={entry.path}
                        entry={entry}
                        activeBranch={activeBranch}
                        baseBranch={baseBranch}
                        onClick={() => router.push(entryEditUrl(entry))}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-3">
              <span className="text-sm text-muted-foreground">
                {filtered.length === 0
                  ? 'No entries'
                  : `Showing ${startIdx}-${endIdx} of ${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 rounded-full px-3"
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1 rounded-full px-3"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </div>
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
  activeBranch,
}: {
  entries: EntryListItem[];
  collections: string[];
  hasBranch: boolean;
  activeBranch: string;
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

  return <ContentTable entries={entries} collections={collections} activeBranch={activeBranch} />;
}

// ---------------------------------------------------------------------------
// Entry row
// ---------------------------------------------------------------------------

function entryRowActivateKey(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' ';
}

function EntryRow({
  entry,
  activeBranch,
  baseBranch,
  onClick,
}: {
  entry: EntryListItem;
  activeBranch: string;
  baseBranch: string;
  onClick: () => void;
}) {
  const config = useConfig();
  const branchLabel = entry.status === 'merged' ? baseBranch : activeBranch || '—';

  return (
    <tr
      tabIndex={0}
      className={cn(
        'cursor-pointer border-b border-border transition-colors hover:bg-[var(--surface-2)]',
        entry.status === 'archived' && 'opacity-60',
      )}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!entryRowActivateKey(e)) return;
        e.preventDefault();
        onClick();
      }}
    >
      <td className="px-4 py-3 text-sm font-medium text-foreground">
        <span className="inline-flex items-center gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-[var(--surface-2)] text-muted-foreground">
            {entry.thumbnailUrl ? (
              <img src={entry.thumbnailUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <ImageIcon className="h-3.5 w-3.5 opacity-60" />
            )}
          </span>
          <span className="truncate">{entry.title}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {config.collections[entry.type as keyof typeof config.collections]?.label ?? entry.type}
      </td>
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1.5 text-sm"
          style={{ color: `var(--st-${entry.status})` }}
          title={entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        >
          <GitBranch className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono text-xs">{branchLabel}</span>
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground" title={formatUpdatedAtFull(entry.updatedAt)}>
        {formatUpdatedAt(entry.updatedAt)}
      </td>
    </tr>
  );
}
