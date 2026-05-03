// Real admin TopHeader — replaces the legacy
// `octocms/components/Header/Header.tsx`. Sticky 56px tall on every admin
// page; wired to real auth + branch + agent state via TanStack Query hooks
// (see `octocms/admin/query/hooks/`).
'use client';

import * as React from 'react';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ExternalLink, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';

import { useAgentStatus } from '../../admin/query/hooks/useAgentStatus';
import { useBranch } from '../../admin/query/hooks/useBranch';
import { useBranchList } from '../../admin/query/hooks/useBranchList';
import { useClearBranch, usePublishBranch, useSetActiveBranch } from '../../admin/query/hooks/useBranchMutations';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
import { useIsProduction } from '../../admin/query/hooks/useIsProduction';
import { useConfig } from '../../hooks/useConfig';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { BranchChip, Kbd } from '../ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import CreateBranchDialog from '../CreateBranchDialog';
import { ThemeToggle, type Theme } from '../../admin/theme';

import { AgentNavSkeleton } from './skeletons/AgentNavSkeleton';
import { BranchChipSkeleton } from './skeletons/BranchChipSkeleton';

const NAV: { id: string; label: string; href: string; matchPrefix?: string }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/cms', matchPrefix: '/cms' },
  { id: 'content', label: 'Content', href: '/cms/content', matchPrefix: '/cms/content' },
  { id: 'media', label: 'Media', href: '/cms/media', matchPrefix: '/cms/media' },
  { id: 'model', label: 'Model', href: '/cms/model', matchPrefix: '/cms/model' },
  { id: 'chat', label: 'Chat', href: '/cms/chat', matchPrefix: '/cms/chat' },
];

type TopHeaderProps = {
  onCommandK?: () => void;
  initialTheme?: Theme;
};

export function TopHeader({ onCommandK, initialTheme = 'dark' }: TopHeaderProps) {
  const { data } = useSession();
  const config = useConfig();
  const pathname = usePathname() ?? '/cms';

  const isProductionQuery = useIsProduction();
  const agentStatusQuery = useAgentStatus();
  const branchQuery = useBranch();
  const hasActiveBranchQuery = useHasActiveBranch();

  const [branchOpen, setBranchOpen] = React.useState(false);
  const [createBranchOpen, setCreateBranchOpen] = React.useState(false);
  const branchListQuery = useBranchList({ enabled: branchOpen });

  const setActiveBranchMutation = useSetActiveBranch();
  const clearBranchMutation = useClearBranch();
  const publishBranchMutation = usePublishBranch();

  const isProduction = isProductionQuery.data ?? false;
  const agentEnabled = agentStatusQuery.data?.enabled ?? false;
  const agentStatusLoading = agentStatusQuery.isPending;
  const activeBranch = branchQuery.data ?? '';
  const isFeatureBranch = hasActiveBranchQuery.data ?? false;
  const branchChipLoading = branchQuery.isPending || hasActiveBranchQuery.isPending;
  const cmsBranches = branchListQuery.data ?? [];
  const branchListLoading = branchListQuery.isPending && branchListQuery.fetchStatus !== 'idle';

  const active: string =
    NAV.slice()
      .reverse()
      .find((n) => n.matchPrefix && pathname.startsWith(n.matchPrefix))?.id ?? 'dashboard';

  const handleSwitchBranch = async (branch: string, isBaseRow: boolean) => {
    if (isBaseRow) {
      await clearBranchMutation.mutateAsync();
      toast({ title: `Viewing ${branch} (read-only)`, variant: 'success' });
      return;
    }
    await setActiveBranchMutation.mutateAsync(branch);
    toast({ title: `Switched to ${branch}`, variant: 'success' });
  };

  const handleClearBranch = async () => {
    await clearBranchMutation.mutateAsync();
    toast({ title: 'Back to main branch', variant: 'success' });
  };

  const handleBranchCreated = (branchName: string, prUrl: string, prWarning?: string) => {
    // CreateBranchDialog already wrote the cookie via `createBranch`; just
    // re-read it (and the branch list) via React Query.
    branchQuery.refetch();
    hasActiveBranchQuery.refetch();
    branchListQuery.refetch();
    if (prWarning) {
      toast({
        title: 'Branch created',
        description: `${prWarning} You can open a pull request manually on GitHub if needed.`,
        variant: 'success',
      });
    } else {
      toast({ title: 'Branch created', variant: 'success' });
    }
    if (prUrl) window.open(prUrl, '_blank');
  };

  const handlePublish = async (branchName: string) => {
    setBranchOpen(false);
    try {
      await publishBranchMutation.mutateAsync(branchName);
      toast({ title: `Published: ${branchName}`, variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Publish failed', variant: 'destructive' });
    }
  };

  const userInitials = data?.user?.name
    ? data.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const projectName = config.projectName ?? 'OctoCMS';
  const branchLabel = activeBranch || 'main';
  // Branch ahead count not yet wired; keep 0 until a
  // `getBranchAheadCount(branch)` source is added.
  const ahead = 0;

  /** Any TanStack query fetch or mutation in flight — logo pill shows a spinner instead of the external-link icon. */
  const fetchingCount = useIsFetching();
  const mutatingCount = useIsMutating();
  const isHeaderLoading = fetchingCount > 0 || mutatingCount > 0;

  return (
    <header className="sticky top-0 z-50 flex h-14 flex-none items-center gap-[10px] border-b border-[var(--border)] bg-[var(--surface-1)] px-6 text-[var(--text)]">
      {/* Logo pill — transparent with border, links to main site */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring inline-flex h-8 shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap rounded-full border border-[var(--border)] bg-transparent px-3 text-[14px] font-bold tracking-[-0.01em] text-[var(--text)] no-underline"
        aria-busy={isHeaderLoading}
        aria-label={isHeaderLoading ? `${projectName} — loading` : `${projectName} — opens site in new tab`}
      >
        <span className="overflow-hidden text-ellipsis">{projectName}</span>
        {isHeaderLoading ? (
          <Loader2 size={12} className="h-3 w-3 shrink-0 animate-spin text-[var(--st-changed)]" aria-hidden />
        ) : (
          <ExternalLink size={12} className="h-3 w-3 shrink-0 opacity-75" aria-hidden />
        )}
      </a>

      <span className="mx-1 h-[22px] w-px bg-[var(--border)]" />

      {/* Nav */}
      <nav className="flex flex-none items-center gap-0.5">
        {NAV.map((n) => {
          if (n.id === 'chat') {
            if (agentStatusLoading) return <AgentNavSkeleton key={n.id} />;
            if (!agentEnabled) return null;
          }
          const isActive = active === n.id;
          return (
            <Link
              key={n.id}
              href={n.href}
              className={cn(
                'focus-ring inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-[14px] text-[14px] tracking-[-0.005em] no-underline',
                isActive
                  ? 'bg-[var(--surface-2)] font-semibold text-[var(--text)]'
                  : 'bg-transparent font-medium text-[var(--text-2)] hover:text-[var(--text)]',
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />

      {/* Search trigger — opens CommandK */}
      <button
        type="button"
        onClick={onCommandK}
        className="focus-ring inline-flex h-8 min-w-[140px] cursor-pointer items-center justify-between gap-2 overflow-hidden whitespace-nowrap rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 text-[12px] text-[var(--muted)]"
        style={{ flex: '0 1 150px' }}
      >
        <span className="inline-flex items-center gap-2 overflow-hidden">
          <Search size={13} className="shrink-0" />
          <span className="overflow-hidden text-ellipsis">Search…</span>
        </span>
        <span className="flex shrink-0 gap-1">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <span className="mx-1 h-[22px] w-px bg-[var(--border)]" />

      {/* Branch chip — always visible; interactive only on a feature branch in production */}
      {branchChipLoading ? (
        <BranchChipSkeleton />
      ) : isFeatureBranch && isProduction ? (
        <DropdownMenu open={branchOpen} onOpenChange={setBranchOpen}>
          <DropdownMenuTrigger asChild>
            <BranchChip name={branchLabel} ahead={ahead} />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[300px]" sideOffset={5} align="end">
            <DropdownMenuItem
              className="cursor-pointer gap-2 text-sm"
              onSelect={() => {
                setBranchOpen(false);
                setCreateBranchOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              New branch
            </DropdownMenuItem>

            {(branchListLoading || cmsBranches.length > 0) && <DropdownMenuSeparator />}

            {branchListLoading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--muted)]">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading…
              </div>
            )}

            {!branchListLoading &&
              cmsBranches.map((b) => (
                <div key={b.branch} className="flex items-center gap-2 rounded px-3 py-1.5 text-sm">
                  <span className="w-3 shrink-0 text-xs text-[var(--brand-strong)]">
                    {b.branch === activeBranch ? '●' : ''}
                  </span>
                  <button
                    type="button"
                    className="flex-1 cursor-pointer truncate border-none bg-transparent py-0.5 text-left font-mono text-xs text-[var(--text)]"
                    onClick={() => handleSwitchBranch(b.branch, b.prNumber === 0 && !b.prUrl)}
                  >
                    {b.branch}
                  </button>
                  {b.isPublished && <span className="shrink-0 px-1 text-xs font-semibold text-[var(--ok)]">Live</span>}
                  {!b.isPublished && (
                    <button
                      type="button"
                      className="shrink-0 cursor-pointer rounded border-none bg-transparent px-1 py-0.5 text-xs text-[var(--muted)] hover:text-[var(--ok)]"
                      onClick={() => handlePublish(b.branch)}
                      title={`Publish ${b.branch}`}
                    >
                      Publish
                    </button>
                  )}
                  {b.prUrl && (
                    <a
                      href={b.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 text-[var(--muted)] hover:text-[var(--text)]"
                      onClick={(e) => e.stopPropagation()}
                      title="Open PR on GitHub"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer gap-2 text-sm text-[var(--muted)]" onSelect={handleClearBranch}>
              <X className="h-4 w-4" />
              Back to main
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <BranchChip name={branchLabel} ahead={ahead} disabled />
      )}

      {/* User avatar dropdown — design.html omits the chevron */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="focus-ring inline-flex h-8 cursor-pointer items-center rounded-full border-0 bg-transparent px-1 text-[var(--text-2)]"
            aria-label="Account"
          >
            <Avatar className="h-[26px] w-[26px]">
              <AvatarImage src={data?.user?.image ?? ''} alt={data?.user?.name ?? ''} />
              <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-[11.5px] font-semibold text-white">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="min-w-[180px]" sideOffset={8} align="end">
          {data?.user?.name && <div className="px-3 py-2 text-sm font-medium text-foreground">{data.user.name}</div>}
          <ThemeToggle initialTheme={initialTheme} />
          <DropdownMenuSeparator />
          <DropdownMenuItem className="cursor-pointer" onSelect={() => signOut()}>
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        onBranchCreated={handleBranchCreated}
      />
    </header>
  );
}
