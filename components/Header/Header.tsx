'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import React, { useEffect, useState } from 'react';
import { GitBranch, ExternalLink, Plus, X, RefreshCw, Radio, Search, Image, FileText } from 'lucide-react';

import {
  getIsProduction,
  getBranch,
  hasActiveBranch,
  clearBranch,
  setActiveBranch,
  listCMSBranches,
  publishBranch,
  type CMSBranch,
} from '../../admin/actions';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui';
import CreateBranchDialog from '../CreateBranchDialog';
import { ThemeToggle } from './ThemeToggle';

type HeaderProps = {
  title: string;
};

const Header = ({ title: _title }: HeaderProps) => {
  const { data } = useSession();
  const pathname = usePathname();
  const [isProduction, setIsProduction] = useState(false);
  const [activeBranch, setActiveBranchState] = useState<string>('');
  const [isFeatureBranch, setIsFeatureBranch] = useState(false);
  const [cmsBranches, setCmsBranches] = useState<CMSBranch[]>([]);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [isBranchLoading, setIsBranchLoading] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    getIsProduction().then(setIsProduction);
    getBranch().then(setActiveBranchState);
    hasActiveBranch().then(setIsFeatureBranch);

    const handler = () => {
      getBranch().then(setActiveBranchState);
      hasActiveBranch().then(setIsFeatureBranch);
    };
    window.addEventListener('cms:branch-changed', handler);
    return () => window.removeEventListener('cms:branch-changed', handler);
  }, []);

  const handleBranchDropdownOpen = async (open: boolean) => {
    setBranchDropdownOpen(open);
    if (open) {
      setIsBranchLoading(true);
      const branches = await listCMSBranches();
      setCmsBranches(branches);
      setIsBranchLoading(false);
    }
  };

  const handleSwitchBranch = async (branch: string, isBaseRow: boolean) => {
    if (isBaseRow) {
      await clearBranch();
      getBranch().then(setActiveBranchState);
      setIsFeatureBranch(false);
      toast({ title: `Viewing ${branch} (read-only)`, variant: 'success' });
      window.dispatchEvent(new Event('cms:branch-changed'));
      return;
    }

    await setActiveBranch(branch);
    setActiveBranchState(branch);
    setIsFeatureBranch(true);
    toast({ title: `Switched to ${branch}`, variant: 'success' });
  };

  const handleClearBranch = async () => {
    await clearBranch();
    getBranch().then(setActiveBranchState);
    setIsFeatureBranch(false);
    toast({ title: 'Back to main branch', variant: 'success' });
    window.dispatchEvent(new Event('cms:branch-changed'));
  };

  const handleBranchCreated = (branchName: string, prUrl: string, prWarning?: string) => {
    setActiveBranchState(branchName);
    setIsFeatureBranch(true);
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
    window.dispatchEvent(new Event('cms:branch-changed'));
  };

  const handlePublish = async (branchName: string) => {
    setIsPublishing(true);
    setBranchDropdownOpen(false);
    const result = await publishBranch(branchName);
    setIsPublishing(false);

    if (result.success) {
      const branches = await listCMSBranches();
      setCmsBranches(branches);
      toast({ title: `Published: ${branchName}`, variant: 'success' });
    } else {
      toast({ title: result.error, variant: 'destructive' });
    }
  };

  const shortBranch = activeBranch.length > 22 ? `${activeBranch.slice(0, 20)}…` : activeBranch;
  const publishedBranch = cmsBranches.find((b) => b.isPublished)?.branch;
  const activeIsPublished = publishedBranch === activeBranch;

  const userInitials = data?.user?.name
    ? data.user.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <header className="sticky top-0 inset-x-0 z-100 h-14 shrink-0 bg-background border-b border-border flex items-center justify-between px-4">
      {/* Left: logo + nav */}
      <div className="flex items-center gap-1">
        {/* Logo */}
        <Link href="/cms" className="mr-3 flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shrink-0">
          <span className="text-sm font-bold text-white">C</span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center">
          <NavLink href="/cms" active={pathname === '/cms'} icon={<FileText className="h-4 w-4" />}>
            Content
          </NavLink>
          <NavLink href="/cms/media" active={pathname.startsWith('/cms/media')} icon={<Image className="h-4 w-4" />}>
            Media
          </NavLink>
          <NavLink href="/cms/search" active={pathname.startsWith('/cms/search')} icon={<Search className="h-4 w-4" />}>
            Search
          </NavLink>
        </nav>
      </div>

      {/* Right: branch, dev tools, user */}
      <div className="flex items-center gap-2">
        {/* Branch chip */}
        {activeBranch && (
          <>
            {isProduction ? (
              <DropdownMenu open={branchDropdownOpen} onOpenChange={handleBranchDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'gap-1.5 rounded-full px-3 text-xs font-mono h-7',
                      isFeatureBranch && 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
                    )}
                  >
                    <GitBranch className="h-3 w-3" />
                    {shortBranch}
                    <span className="opacity-60">▾</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="min-w-[300px]" sideOffset={5} align="end">
                  <DropdownMenuItem
                    className="gap-2 text-sm cursor-pointer"
                    onSelect={() => {
                      setBranchDropdownOpen(false);
                      setCreateBranchOpen(true);
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    New branch
                  </DropdownMenuItem>

                  {(isBranchLoading || cmsBranches.length > 0) && <DropdownMenuSeparator />}

                  {isBranchLoading && (
                    <div className="flex items-center gap-2 py-2 px-3 text-sm text-muted-foreground">
                      <RefreshCw className="h-3 w-3 animate-spin" />
                      Loading…
                    </div>
                  )}

                  {!isBranchLoading &&
                    cmsBranches.map((b) => (
                      <div key={b.branch} className="flex items-center gap-2 px-3 py-1.5 text-sm rounded">
                        <span className="w-3 shrink-0 text-blue-600 text-xs">
                          {b.branch === activeBranch ? '●' : ''}
                        </span>
                        <button
                          type="button"
                          className="flex-1 font-mono text-xs truncate text-left cursor-pointer bg-transparent border-none text-foreground hover:text-foreground py-0.5"
                          onClick={() => handleSwitchBranch(b.branch, b.prNumber === 0 && !b.prUrl)}
                        >
                          {b.branch}
                        </button>
                        {b.isPublished && (
                          <span className="shrink-0 text-xs text-green-600 font-semibold px-1">Live</span>
                        )}
                        {!b.isPublished && (
                          <button
                            type="button"
                            className="shrink-0 text-xs text-muted-foreground hover:text-green-600 bg-transparent border-none cursor-pointer px-1 py-0.5 rounded"
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
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                            title="Open PR on GitHub"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    ))}

                  {isFeatureBranch && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-sm cursor-pointer text-muted-foreground"
                        onSelect={handleClearBranch}
                      >
                        <X className="h-4 w-4" />
                        Back to main
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-mono text-muted-foreground opacity-60 cursor-not-allowed">
                <GitBranch className="h-3 w-3" />
                {shortBranch}
              </span>
            )}

            {/* Publish button — prod, active branch not published */}
            {isProduction && !activeIsPublished && cmsBranches.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePublish(activeBranch)}
                disabled={isPublishing}
                className="gap-1.5 h-7 text-xs text-green-700 border-green-200 bg-green-50 hover:bg-green-100"
              >
                <Radio className="h-3 w-3" />
                {isPublishing ? 'Publishing…' : 'Publish'}
              </Button>
            )}
          </>
        )}

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center bg-transparent border-none cursor-pointer rounded-full ml-1"
            >
              <Avatar className="h-7 w-7">
                <AvatarImage src={data?.user?.image ?? ''} alt={data?.user?.name ?? ''} />
                <AvatarFallback className="bg-gradient-to-br from-blue-500 to-violet-500 text-white text-xs">
                  {userInitials}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="min-w-[180px]" sideOffset={8} align="end">
            {data?.user?.name && (
              <>
                <div className="px-3 py-2 text-sm font-medium text-foreground">{data.user.name}</div>
                <DropdownMenuSeparator />
              </>
            )}
            <ThemeToggle />
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onSelect={() => signOut()}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CreateBranchDialog
        open={createBranchOpen}
        onOpenChange={setCreateBranchOpen}
        onBranchCreated={handleBranchCreated}
      />
    </header>
  );
};

function NavLink({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button
      asChild
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      className={cn(
        'gap-1.5 h-8 px-3 text-sm font-normal',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      <Link href={href}>
        {icon}
        {children}
      </Link>
    </Button>
  );
}

export default Header;
