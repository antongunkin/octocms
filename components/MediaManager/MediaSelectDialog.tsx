'use client';

/**
 * Modal media browser used by `FormImageField`'s "Select existing image"
 * action. Mirrors the chrome of `/cms/media` in compact form: search input,
 * grid / list view toggle, folder left panel — but inside a Dialog and with
 * a click-to-select callback instead of routing to the asset editor.
 *
 * Loads the media list lazily on first open and refreshes whenever the
 * dialog re-opens, so newly-uploaded images surface here without needing
 * a parent re-render.
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle, Icon } from '../ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { useMediaList } from '../../admin/query/hooks/useMediaList';
import { useMediaCustomFolders } from '../../hooks/useMediaCustomFolders';
import { cn } from '../../lib/utils';
import type { MediaFile } from '../../types';

import { MediaLeftPanel } from './MediaLeftPanel';
import { MediaListTable } from './MediaListTable';
import { MediaViewModeSwitcher } from './MediaViewModeSwitcher';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'octocms:media-view-mode';

type MediaSelectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Currently selected media id (highlighted in the grid/list). */
  selectedId?: string;
  /** Fires when the user picks an image — caller closes the dialog. */
  onSelect: (file: MediaFile) => void;
};

export function MediaSelectDialog({ open, onOpenChange, selectedId, onSelect }: MediaSelectDialogProps) {
  const { data: files = [], isPending, refetch } = useMediaList({ enabled: open });
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { folders: customFolders } = useMediaCustomFolders();
  const searchRef = useRef<HTMLInputElement>(null);

  // Refresh when the dialog opens so newly-uploaded images surface (shared cache with `/cms/media`).
  useEffect(() => {
    if (!open) return;
    void refetch();
  }, [open, refetch]);

  // Persist the view-mode pick alongside the standalone /cms/media library.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(VIEW_MODE_KEY);
      if (stored === 'grid' || stored === 'list') setViewMode(stored);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  const folders = useMemo(() => {
    const fromFiles = Array.from(new Set(files.map((f) => f.folder).filter((f) => f !== '/')));
    const combined = Array.from(new Set([...fromFiles, ...customFolders])).sort();
    return ['/', ...combined];
  }, [files, customFolders]);

  const countByFolder = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const f of files) counts[f.folder] = (counts[f.folder] ?? 0) + 1;
    return counts;
  }, [files]);

  const filteredFiles = useMemo(() => {
    let result = selectedFolder === null ? files : files.filter((f) => f.folder === selectedFolder);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) => f.originalName.toLowerCase().includes(q) || (f.title ?? '').toLowerCase().includes(q),
      );
    }
    return result;
  }, [files, selectedFolder, searchQuery]);

  const handlePick = (file: MediaFile) => {
    onSelect(file);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="octo-dialog-content octo-dialog-content--5xl octo-dialog-content--vh-80 octo-dialog-content--flex-col octo-dialog-content--overflow-hidden octo-dialog-content--no-padding">
        <DialogHeader className="octo-dialog-header octo-dialog-header--bordered">
          <DialogTitle>Select an image</DialogTitle>
        </DialogHeader>

        <div className="octo-media-select-dialog__body">
          <aside className="octo-media-select-dialog__sidebar" aria-label="Folders">
            <div className="octo-media-select-dialog__sidebar-inner">
              <MediaLeftPanel
                folders={folders}
                selectedFolder={selectedFolder}
                countByFolder={countByFolder}
                totalCount={files.length}
                customFolders={[]}
                onSelectAll={() => setSelectedFolder(null)}
                onSelectFolder={(f) => setSelectedFolder(f)}
                onAddFolder={() => {
                  /* folder management lives on /cms/media — not exposed here */
                }}
                onDeleteFolder={() => {
                  /* folder management lives on /cms/media — not exposed here */
                }}
              />
            </div>
          </aside>

          <div className="octo-media-select-dialog__content">
            <div className="octo-media-select-dialog__toolbar">
              <div className="octo-media-select-dialog__search-wrap">
                <Icon.Search className="octo-media-select-dialog__search-icon octo-icon-md" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter assets…"
                  className="octo-media-select-dialog__search-input"
                />
              </div>
              <MediaViewModeSwitcher value={viewMode} onChange={setViewMode} />
            </div>

            <div className="octo-media-select-dialog__scroll">
              {isPending && files.length === 0 ? (
                <div className="octo-media-select-dialog__loading">Loading…</div>
              ) : filteredFiles.length === 0 ? (
                <div className="octo-media-select-dialog__empty">
                  <Icon.Image className="octo-icon-2xl" />
                  <p className="octo-u-text-base">
                    {searchQuery ? 'No assets match this search' : 'No files in this folder'}
                  </p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="octo-media-grid octo-media-grid--auto">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedId === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handlePick(file)}
                        className={cn(
                          'octo-media-grid__card',
                          isSelected && 'octo-media-grid__card octo-media-grid__card--selected',
                        )}
                      >
                        <div className="octo-media-grid__img-wrap">
                          <img
                            src={file.publicUrl}
                            alt={file.title || file.originalName}
                            className="octo-media-grid__img"
                            loading="lazy"
                          />
                        </div>
                        <div className="octo-media-grid__info">
                          <p className="octo-media-grid__name">{file.title || file.originalName}</p>
                          <p className="octo-media-grid__meta">
                            {file.extension.toUpperCase()}
                            {file.width != null && file.height != null ? ` · ${file.width}×${file.height}` : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <MediaListTable files={filteredFiles} onPickFile={handlePick} selectedId={selectedId} />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
