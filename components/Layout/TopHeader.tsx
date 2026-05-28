// Real admin TopHeader — replaces the legacy
// `octocms/components/Header/Header.tsx`. Sticky 56px tall on every admin
// page; wired to real auth + branch + agent state via TanStack Query hooks
// (see `octocms/admin/query/hooks/`).
'use client';

import * as React from 'react';
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Icon, Avatar, AvatarFallback, AvatarImage, BranchChip, Kbd } from '../ui';

import { invalidateAfterMutationAsync } from '../../admin/query/invalidate';
import { useBranch } from '../../admin/query/hooks/useBranch';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
import { useConfig } from '../../hooks/useConfig';
import { useCmsSession } from '../../hooks/useCmsSession';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { BranchSelectorDialog } from './BranchSelectorDialog';
import CreateBranchDialog from './CreateBranchDialog';
import { UserAccountDialog } from './UserAccountDialog';
import type { Theme } from '../../admin/theme';

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
  const { data } = useCmsSession();
  const config = useConfig();
  const pathname = usePathname() ?? '/cms';
  const router = useRouter();
  const qc = useQueryClient();

  const branchQuery = useBranch();
  const hasActiveBranchQuery = useHasActiveBranch();

  const [branchOpen, setBranchOpen] = React.useState(false);
  const [createBranchOpen, setCreateBranchOpen] = React.useState(false);
  const [userOpen, setUserOpen] = React.useState(false);

  const activeBranch = branchQuery.data ?? '';
  const branchChipLoading = branchQuery.isPending || hasActiveBranchQuery.isPending;

  const active: string =
    NAV.slice()
      .reverse()
      .find((n) => n.matchPrefix && pathname.startsWith(n.matchPrefix))?.id ?? 'content';

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
          <Icon.Loader2 size={12} className="octo-top-header__logo-spinner" aria-hidden />
        ) : (
          <Icon.ExternalLink size={12} className="octo-top-header__logo-icon" aria-hidden />
        )}
      </a>

      <span className="octo-top-header__sep" />

      {/* Nav */}
      <nav className="octo-top-header__nav">
        {NAV.map((n) => {
          const isActive = active === n.id;
          return (
            <Link
              key={n.id}
              href={n.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'octo-top-header__nav-link',
                isActive && 'octo-top-header__nav-link octo-top-header__nav-link--active',
              )}
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
          <Icon.Search size={13} className="octo-u-shrink-0" />
          <span className="octo-top-header__search-text">Search…</span>
        </span>
        <span className="octo-top-header__search-kbd">
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <span className="octo-top-header__sep" />

      {/* Branch chip — always visible; dialog opens in dev and prod (create branch before any edit) */}
      {branchChipLoading ? (
        <BranchChipSkeleton />
      ) : (
        <BranchChip
          name={branchLabel}
          ahead={ahead}
          menuTrigger
          aria-label={`Branch menu, ${branchLabel}`}
          onClick={() => setBranchOpen(true)}
        />
      )}

      <button
        type="button"
        className="octo-top-header__user-btn"
        aria-label="Account"
        onClick={() => setUserOpen(true)}
      >
        <Avatar className="octo-top-header__avatar">
          {data?.user?.image && <AvatarImage src={data.user.image} alt={userInitials} />}
          <AvatarFallback className="octo-top-header__avatar-fallback">{userInitials}</AvatarFallback>
        </Avatar>
      </button>

      <BranchSelectorDialog
        open={branchOpen}
        onOpenChange={setBranchOpen}
        activeBranch={activeBranch}
        onRequestCreateBranch={() => setCreateBranchOpen(true)}
      />

      <UserAccountDialog
        open={userOpen}
        onOpenChange={setUserOpen}
        userName={data?.user?.name}
        userImage={data?.user?.image}
        userInitials={userInitials}
        initialTheme={initialTheme}
      />

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        onBranchCreated={handleBranchCreated}
      />
    </header>
  );
}
