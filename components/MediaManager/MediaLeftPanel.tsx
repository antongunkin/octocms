'use client';

import { FolderOpen, ImageIcon, Plus, X } from 'lucide-react';
import React from 'react';

import { LeftNavItem } from '../Layout/LeftNavItem';
import { Button } from '../ui/button';

export type MediaLeftPanelProps = {
  folders: string[];
  selectedFolder: string | null;
  countByFolder: Record<string, number>;
  totalCount: number;
  customFolders: string[];
  onSelectAll: () => void;
  onSelectFolder: (folder: string) => void;
  onAddFolder: () => void;
  onDeleteFolder: (folder: string) => void;
};

export function MediaLeftPanel({
  folders,
  selectedFolder,
  countByFolder,
  totalCount,
  customFolders,
  onSelectAll,
  onSelectFolder,
  onAddFolder,
  onDeleteFolder,
}: MediaLeftPanelProps) {
  const isAllActive = selectedFolder === null;
  const customSet = new Set(customFolders);

  return (
    <aside className="flex w-[248px] shrink-0 flex-col overflow-y-auto border-r border-border bg-[var(--surface-2)]">
      <nav className="space-y-0.5 px-3 py-4">
        <LeftNavItem
          icon={<ImageIcon className="h-4 w-4" />}
          label="All files"
          count={totalCount}
          active={isAllActive}
          onClick={onSelectAll}
        />
      </nav>

      <div className="px-3 pb-4 pt-1">
        <div className="mb-1 flex items-center px-2">
          <p className="flex-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Folders</p>
          <Button
            variant="ghost"
            size="icon"
            className="-mr-1 h-5 w-5 text-muted-foreground"
            onClick={onAddFolder}
            aria-label="Add folder"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        <nav className="space-y-0.5">
          {folders.map((folder) => {
            const label = folder === '/' ? 'Root' : folder;
            const active = selectedFolder === folder;
            const canDelete = folder !== '/' && customSet.has(folder);
            const count = countByFolder[folder] ?? 0;
            return (
              <div key={folder} className="group relative">
                {/*
                  Pass `count` to LeftNavItem only when there's no inline delete
                  button to swap with — otherwise we render the count and the
                  delete `<button>` as siblings of LeftNavItem so we don't
                  nest a button inside another button (invalid HTML).
                */}
                <LeftNavItem
                  icon={<FolderOpen className="h-4 w-4" />}
                  label={label}
                  count={canDelete ? undefined : count}
                  active={active}
                  onClick={() => onSelectFolder(folder)}
                />
                {canDelete && (
                  <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center">
                    <span
                      className={
                        active
                          ? 'text-xs tabular-nums text-foreground/60 group-hover:hidden'
                          : 'text-xs tabular-nums text-muted-foreground group-hover:hidden'
                      }
                    >
                      {count}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFolder(folder);
                      }}
                      aria-label={`Delete folder ${folder}`}
                      className="pointer-events-auto hidden h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--surface-1)] hover:text-destructive group-hover:flex"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
