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
} from '../ui/icons';

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
    <div className="octo-page-shell">
      {/* Page header */}
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-page-chrome__breadcrumb">
            <span className="octo-u-text-2">Content</span>
          </div>
          <div className="octo-page-chrome__title-row">
            <h1 className="octo-page-chrome__title">{selectedTypeLabel ?? 'Content'}</h1>
          </div>
        </div>
        <div className="octo-page-chrome__right">
          <AddEntryButton collections={addCollections} />
        </div>
      </div>

      {/* Body: left nav + right content */}
      <div className="octo-page-row">
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
        <Button size="sm" variant="default" disabled={creating}>
          <Plus className="octo-icon-md" />
          Add content
          <ChevronDown className="octo-icon-xs octo-u-opacity-70" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {collections.map((c) => (
          <DropdownMenuItem key={c} onSelect={() => handleCreate(c)}>
            <FileText className="octo-icon-md octo-u-text-muted" />
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
    <aside className="octo-left-panel">
      <div className="octo-left-panel__bar">
        <div className="octo-left-panel__section">
          <nav className="octo-left-panel__nav">
            <LeftNavItem
              href="/cms"
              icon={<LayoutList className="octo-icon-md" />}
              label="All content"
              count={entries.length}
              active={!isBranched && !isRecent && !selectedType}
            />
            <LeftNavItem
              href="/cms?tab=branched"
              icon={<GitBranch className="octo-icon-md" />}
              label="Branched content"
              count={branchedCount}
              active={isBranched}
            />
            <LeftNavItem
              href="/cms?tab=recent"
              icon={<GitPullRequest className="octo-icon-md" />}
              label="Recent PRs"
              count={recentPRsCount}
              active={isRecent}
            />
          </nav>
        </div>
        {collections.length > 0 && (
          <div className="octo-left-panel__section">
            <span className="octo-left-panel__section-label">Collections</span>
            <nav className="octo-left-panel__nav">
              {collections.map((c) => {
                const label = config.collections[c as keyof typeof config.collections]?.label ?? c;
                return (
                  <LeftNavItem
                    key={c}
                    href={`/cms/content/${c}`}
                    icon={<FileText className="octo-icon-md" />}
                    label={label}
                    count={countByType[c] ?? 0}
                    active={selectedType === c}
                  />
                );
              })}
            </nav>
          </div>
        )}
      </div>
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
    <div className="octo-content-area">
      <div className="octo-content-table-wrap">
        <div className="octo-content-table-inner">
          <div className="octo-content-filters">
            <div className="octo-content-search">
              <Search className="octo-content-search__icon octo-icon-md" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter entries…"
                className="octo-content-search__input"
              />
              <kbd className="octo-content-search__kbd">/</kbd>
            </div>
            {!lockedType && (
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="octo-select__trigger octo-select__trigger--pill">
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
              <SelectTrigger className="octo-select__trigger octo-select__trigger--pill">
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
            <div className="octo-content-sort">
              <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as 'newest' | 'oldest')}>
                <SelectTrigger className="octo-select__trigger octo-select__trigger--pill">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest first</SelectItem>
                  <SelectItem value="oldest">Oldest first</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="octo-content-card">
            <div className="octo-content-card__scroll">
              <table className="octo-content-card__table">
                <thead>
                  <tr className="octo-content-card__th-row">
                    <th className="octo-content-card__th">Title</th>
                    <th className="octo-content-card__th">Type</th>
                    <th className="octo-content-card__th">Branch</th>
                    <th className="octo-content-card__th">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="octo-content-row__empty">
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

            <div className="octo-content-card__footer">
              <span className="octo-content-card__footer-count">
                {filtered.length === 0
                  ? 'No entries'
                  : `Showing ${startIdx}-${endIdx} of ${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`}
              </span>
              <div className="octo-content-card__footer-pages">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                  <ChevronLeft className="octo-icon-sm" />
                  Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="octo-icon-sm" />
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
      <div className="octo-branched-empty">
        <div className="octo-branched-empty__inner">
          <div className="octo-branched-empty__icon">
            <GitBranch className="octo-icon-lg" />
          </div>
          <p className="octo-branched-empty__title">No active branch</p>
          <p className="octo-branched-empty__text">
            Create a branch to start tracking content changes separately from the main branch.
          </p>
        </div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="octo-branched-empty">
        <div className="octo-branched-empty__inner">
          <div className="octo-branched-empty__icon">
            <GitBranch className="octo-icon-lg" />
          </div>
          <p className="octo-branched-empty__title">No changes on this branch yet</p>
          <p className="octo-branched-empty__text">Edits you make will appear here.</p>
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
      className={cn('octo-content-row', entry.status === 'archived' && 'octo-content-row octo-content-row--archived')}
      onClick={onClick}
      onKeyDown={(e) => {
        if (!entryRowActivateKey(e)) return;
        e.preventDefault();
        onClick();
      }}
    >
      <td className="octo-content-row__td">
        <span className="octo-content-row__thumb-wrap">
          <span className="octo-content-row__thumb">
            {entry.thumbnailUrl ? (
              <img src={entry.thumbnailUrl} alt="" loading="lazy" />
            ) : (
              <ImageIcon className="octo-icon-sm octo-u-opacity-60" />
            )}
          </span>
          <span className="octo-content-row__title">{entry.title}</span>
        </span>
      </td>
      <td className="octo-content-row__td octo-content-row__meta">
        {config.collections[entry.type as keyof typeof config.collections]?.label ?? entry.type}
      </td>
      <td className="octo-content-row__td">
        <span
          className="octo-content-row__branch"
          style={{ color: `var(--st-${entry.status})` }}
          title={entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}
        >
          <GitBranch className="octo-icon-sm octo-u-shrink-0" />
          <span className="octo-content-row__branch-label">{branchLabel}</span>
        </span>
      </td>
      <td className="octo-content-row__td octo-content-row__meta" title={formatUpdatedAtFull(entry.updatedAt)}>
        {formatUpdatedAt(entry.updatedAt)}
      </td>
    </tr>
  );
}
