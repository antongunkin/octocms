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

import { ImageIcon, LayoutGrid, List, Search } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { getMediaEntries } from '../../admin/actions';
import { useMediaCustomFolders } from '../../hooks/useMediaCustomFolders';
import { cn } from '../../lib/utils';
import type { MediaFile } from '../../types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

import { MediaLeftPanel } from './MediaLeftPanel';
import { MediaListTable } from './MediaListTable';

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
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [loading, setLoading] = useState(false);
  const { folders: customFolders } = useMediaCustomFolders();
  const searchRef = useRef<HTMLInputElement>(null);

  // Load (or refresh) the media list each time the dialog re-opens.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getMediaEntries()
      .then(setFiles)
      .catch(() => setFiles([]))
      .finally(() => setLoading(false));
  }, [open]);

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
      <DialogContent className="flex h-[80vh] max-w-5xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Select an image</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
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

          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-3">
              <div className="relative min-w-[220px] max-w-[420px] flex-[0_1_420px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  ref={searchRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter assets…"
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
                />
              </div>
              <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div>
              ) : filteredFiles.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                  <ImageIcon className="h-12 w-12" />
                  <p className="text-sm">{searchQuery ? 'No assets match this search' : 'No files in this folder'}</p>
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                  {filteredFiles.map((file) => {
                    const isSelected = selectedId === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => handlePick(file)}
                        className={cn(
                          'group relative cursor-pointer overflow-hidden rounded-xl border bg-background text-left transition-all hover:border-foreground/40 hover:shadow-sm',
                          isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border',
                        )}
                      >
                        <div className="aspect-square bg-[var(--surface-2)]">
                          <img
                            src={file.publicUrl}
                            alt={file.title || file.originalName}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="border-t border-border bg-background px-3 py-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {file.title || file.originalName}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
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

function ViewModeSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div
      className="inline-flex items-center rounded-full border border-border bg-background p-0.5"
      role="tablist"
      aria-label="View mode"
    >
      <button
        type="button"
        role="tab"
        aria-selected={value === 'grid'}
        aria-label="Grid view"
        onClick={() => onChange('grid')}
        className={cn(
          'flex h-7 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
          value === 'grid' ? 'bg-[var(--surface-3)] text-foreground' : 'hover:text-foreground',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'list'}
        aria-label="List view"
        onClick={() => onChange('list')}
        className={cn(
          'flex h-7 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors',
          value === 'list' ? 'bg-[var(--surface-3)] text-foreground' : 'hover:text-foreground',
        )}
      >
        <List className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
