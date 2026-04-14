'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { FileText, GitBranch, Image, Menu, Search } from 'lucide-react';

import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { cn } from '../../lib/utils';
import { Button } from '../ui';

export function CMSSidebar() {
  const config = useConfig();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const collections = Object.keys(config.collections) as (keyof Config['collections'])[];

  const isBranchedActive = pathname === '/cms' && searchParams.get('tab') === 'branched';
  const isAllContentActive = pathname === '/cms' && !isBranchedActive;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-background overflow-y-auto">
      <div className="p-2 space-y-6">
        {/* Top nav */}
        <nav className="space-y-0.5">
          <SidebarLink
            href="/cms"
            icon={<Menu className="h-4 w-4" />}
            label="All content"
            active={isAllContentActive}
          />
          <SidebarLink
            href="/cms?tab=branched"
            icon={<GitBranch className="h-4 w-4" />}
            label="Branched content"
            active={isBranchedActive}
          />
        </nav>

        {/* Collections */}
        {collections.length > 0 && (
          <div>
            <p className="mb-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Collections</p>
            <nav className="space-y-0.5">
              {collections.map((collection) => (
                <SidebarLink
                  key={collection}
                  href={`/cms/${collection}`}
                  icon={<FileText className="h-4 w-4" />}
                  label={config.collections[collection].label ?? collection}
                  active={pathname === `/cms/${collection}` || pathname.startsWith(`/cms/${collection}/`)}
                />
              ))}
            </nav>
          </div>
        )}

        {/* Media & Search */}
        <div>
          <p className="mb-1 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assets</p>
          <nav className="space-y-0.5">
            <SidebarLink
              href="/cms/media"
              icon={<Image className="h-4 w-4" />}
              label="Media"
              active={pathname.startsWith('/cms/media')}
            />
            <SidebarLink
              href="/cms/search"
              icon={<Search className="h-4 w-4" />}
              label="Search"
              active={pathname.startsWith('/cms/search')}
            />
          </nav>
        </div>
      </div>
    </aside>
  );
}

function SidebarLink({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
}) {
  return (
    <Button
      asChild
      variant="ghost"
      className={cn(
        'h-8 w-full justify-start gap-2 px-2 text-sm font-normal',
        active ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-accent',
      )}
    >
      <Link href={href}>
        {icon}
        <span className="flex-1 truncate text-left">{label}</span>
      </Link>
    </Button>
  );
}
