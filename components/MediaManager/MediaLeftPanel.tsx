'use client';

import { Icon } from '../ui';
import React from 'react';

import { LeftNavItem } from '../Layout/LeftNavItem';

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
    <>
      <LeftNavItem
        icon={<Icon.Image className="octo-icon-md" />}
        label="All files"
        count={totalCount}
        active={isAllActive}
        onClick={onSelectAll}
      />

      <div className="octo-media-left-panel__folder-nav">
        <div className="octo-media-left-panel__folders-header">
          <p className="octo-media-left-panel__folders-label">Folders</p>
          <button
            type="button"
            className="octo-media-left-panel__add-folder"
            onClick={onAddFolder}
            aria-label="Add folder"
          >
            <Icon.Plus className="octo-icon-xs" />
          </button>
        </div>
        {folders.map((folder) => {
          const label = folder === '/' ? 'Root' : folder;
          const active = selectedFolder === folder;
          const canDelete = folder !== '/' && customSet.has(folder);
          const count = countByFolder[folder] ?? 0;
          return (
            <div key={folder} className="octo-media-left-panel__folder-row">
              {/*
                  Pass `count` to LeftNavItem only when there's no inline delete
                  button to swap with — otherwise we render the count and the
                  delete `<button>` as siblings of LeftNavItem so we don't
                  nest a button inside another button (invalid HTML).
                */}
              <LeftNavItem
                icon={<Icon.FolderOpen className="octo-icon-md" />}
                label={label}
                count={canDelete ? undefined : count}
                active={active}
                onClick={() => onSelectFolder(folder)}
              />
              {canDelete && (
                <>
                  <span
                    className={`octo-media-left-panel__folder-count ${active ? 'octo-media-left-panel__folder-count octo-media-left-panel__folder-count--active' : 'octo-media-left-panel__folder-count octo-media-left-panel__folder-count--normal'}`}
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
                    className="octo-media-left-panel__folder-del"
                  >
                    <Icon.X className="octo-icon-sm" />
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
