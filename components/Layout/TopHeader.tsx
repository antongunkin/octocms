// Real admin TopHeader — replaces the legacy
// `octocms/components/Header/Header.tsx`. Sticky 56px tall on every admin
// page; wired to real auth + branch + agent state via TanStack Query hooks
// (see `octocms/admin/query/hooks/`).
'use client';

import * as React from 'react';
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { ExternalLink, Loader2, Plus, RefreshCw, Search, X } from 'lucide-react';

import { invalidateAfterMutationAsync } from '../../admin/query/invalidate';
import { useAgentStatus } from '../../admin/query/hooks/useAgentStatus';
import { useBranch } from '../../admin/query/hooks/useBranch';
import { useBranchList } from '../../admin/query/hooks/useBranchList';
import { useClearBranch, usePublishBranch, useSetActiveBranch } from '../../admin/query/hooks/useBranchMutations';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
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

// `content` is the admin index — both `/cms` (canonical) and `/cms/content`
// (legacy alias) render `ContentPage`. The `matchPrefix` of `/cms` is checked
// last (in reverse) so deeper sections (`/cms/media`, `/cms/model`, `/cms/chat`)
// still highlight their own nav item even though they also start with `/cms`.
const NAV: { id: string; label: string; href: string; matchPrefix?: string }[] = [
  { id: 'content', label: 'Content', href: '/cms', matchPrefix: '/cms' },
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
  const router = useRouter();
  const qc = useQueryClient();

  const agentStatusQuery = useAgentStatus();
  const branchQuery = useBranch();
  const hasActiveBranchQuery = useHasActiveBranch();

  const [branchOpen, setBranchOpen] = React.useState(false);
  const [createBranchOpen, setCreateBranchOpen] = React.useState(false);
  const branchListQuery = useBranchList({ enabled: branchOpen });

  const setActiveBranchMutation = useSetActiveBranch();
  const clearBranchMutation = useClearBranch();
  const publishBranchMutation = usePublishBranch();

  const agentEnabled = agentStatusQuery.data?.enabled ?? false;
  const agentStatusLoading = agentStatusQuery.isPending;
  const activeBranch = branchQuery.data ?? '';
  const branchChipLoading = branchQuery.isPending || hasActiveBranchQuery.isPending;
  const cmsBranches = branchListQuery.data ?? [];
  const branchListLoading = branchListQuery.isPending && branchListQuery.fetchStatus !== 'idle';

  const active: string =
    NAV.slice()
      .reverse()
      .find((n) => n.matchPrefix && pathname.startsWith(n.matchPrefix))?.id ?? 'content';

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

  const handleBranchCreated = async (branchName: string, prUrl: string, prWarning?: string) => {
    // Cookie is set on the createBranch response; invalidate git queries and
    // refresh RSC so the branch chip and server actions see the new branch immediately.
    await invalidateAfterMutationAsync(qc, ['git']);
    router.refresh();
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
    <header className="octo-top-header">
      {/* Logo pill — transparent with border, links to main site */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="octo-top-header__logo"
        aria-busy={isHeaderLoading}
        aria-label={isHeaderLoading ? `${projectName} — loading` : `${projectName} — opens site in new tab`}
      >
        <span className="octo-top-header__logo-name">{projectName}</span>
        {isHeaderLoading ? (
          <Loader2
            size={12}
            style={{ flexShrink: 0, color: 'var(--st-changed)', animation: 'octo-spin 1s linear infinite' }}
            aria-hidden
          />
        ) : (
          <ExternalLink size={12} style={{ flexShrink: 0, opacity: 0.75 }} aria-hidden />
        )}
      </a>

      <span className="octo-top-header__sep" />

      {/* Nav */}
      <nav className="octo-top-header__nav">
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
              className={cn('octo-top-header__nav-link', isActive && 'octo-top-header__nav-link--active')}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="octo-top-header__spacer" />

      {/* Search trigger — opens CommandK */}
      <button type="button" onClick={onCommandK} className="octo-top-header__search">
        <span className="octo-top-header__search-inner">
          <Search size={13} style={{ flexShrink: 0 }} />
          <span className="octo-top-header__search-text">Search…</span>
        </span>
        <span className="octo-top-header__search-kbd">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <span className="octo-top-header__sep" />

      {/* Branch chip — always visible; menu opens in dev and prod (create branch before any edit) */}
      {branchChipLoading ? (
        <BranchChipSkeleton />
      ) : (
        <DropdownMenu open={branchOpen} onOpenChange={setBranchOpen}>
          <DropdownMenuTrigger asChild>
            <BranchChip name={branchLabel} ahead={ahead} menuTrigger aria-label={`Branch menu, ${branchLabel}`} />
          </DropdownMenuTrigger>
          <DropdownMenuContent style={{ minWidth: 300 }} sideOffset={5} align="end">
            <DropdownMenuItem
              onSelect={() => {
                setBranchOpen(false);
                setCreateBranchOpen(true);
              }}
            >
              <Plus style={{ width: 16, height: 16 }} />
              Create new branch
            </DropdownMenuItem>

            {(branchListLoading || cmsBranches.length > 0) && <DropdownMenuSeparator />}

            {branchListLoading && (
              <div className="octo-top-header__branch-loading">
                <RefreshCw style={{ width: 12, height: 12, animation: 'octo-spin 1s linear infinite' }} />
                Loading…
              </div>
            )}

            {!branchListLoading &&
              cmsBranches.map((b) => (
                <div key={b.branch} className="octo-top-header__branch-row">
                  <span className="octo-top-header__branch-dot">{b.branch === activeBranch ? '●' : ''}</span>
                  <button
                    type="button"
                    className="octo-top-header__branch-name"
                    onClick={() => handleSwitchBranch(b.branch, b.prNumber === 0 && !b.prUrl)}
                  >
                    {b.branch}
                  </button>
                  {b.isPublished && <span className="octo-top-header__branch-live">Live</span>}
                  {!b.isPublished && (
                    <button
                      type="button"
                      className="octo-top-header__branch-publish"
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
                      style={{ flexShrink: 0, color: 'var(--muted)', textDecoration: 'none' }}
                      onClick={(e) => e.stopPropagation()}
                      title="Open PR on GitHub"
                    >
                      <ExternalLink style={{ width: 12, height: 12 }} />
                    </a>
                  )}
                </div>
              ))}

            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={handleClearBranch}>
              <X style={{ width: 16, height: 16 }} />
              Back to main
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* User avatar dropdown — design.html omits the chevron */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" className="octo-top-header__user-btn" aria-label="Account">
            <Avatar style={{ height: 26, width: 26 }}>
              <AvatarImage src={data?.user?.image ?? ''} alt={data?.user?.name ?? ''} />
              <AvatarFallback
                style={{
                  background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent style={{ minWidth: 180 }} sideOffset={8} align="end">
          {data?.user?.name && (
            <div style={{ padding: '8px 12px', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
              {data.user.name}
            </div>
          )}
          <ThemeToggle initialTheme={initialTheme} />
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => signOut()}>Sign out</DropdownMenuItem>
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
