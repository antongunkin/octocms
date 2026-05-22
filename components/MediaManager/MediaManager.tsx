'use client';

import { ImageIcon, ChevronRight, LayoutGrid, List, Search, Upload } from '../ui/icons';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useMediaList } from '../../admin/query/hooks/useMediaList';
import { useConfig } from '../../hooks/useConfig';
import { useMediaCustomFolders } from '../../hooks/useMediaCustomFolders';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

import { CreateFolderDialog } from './CreateFolderDialog';
import { DeleteFolderDialog } from './DeleteFolderDialog';
import { MediaLeftPanel } from './MediaLeftPanel';
import { MediaListTable } from './MediaListTable';
import { MediaUploadBar } from './MediaUploadBar';
import { MediaUploadDialog } from './MediaUploadDialog';
import { MediaGridSkeleton } from './skeletons/MediaGridSkeleton';
import { MediaLeftPanelSkeleton } from './skeletons/MediaLeftPanelSkeleton';
import { MediaListTableSkeleton } from './skeletons/MediaListTableSkeleton';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'octocms:media-view-mode';

const MediaManager = () => {
  const router = useRouter();
  const config = useConfig();
  const mediaQuery = useMediaList();
  const files = useMemo(() => mediaQuery.data ?? [], [mediaQuery.data]);
  const isLoadingFiles = mediaQuery.isPending && !mediaQuery.data;
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [pendingUpload, setPendingUpload] = useState<File[] | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const { folders: customFolders, add: addCustomFolder, remove: removeCustomFolder } = useMediaCustomFolders();
  const searchRef = useRef<HTMLInputElement>(null);

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

  // Mirror /cms/content's "press / to focus search" affordance.
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

  const breadcrumbFolderLabel =
    selectedFolder === null ? 'All files' : selectedFolder === '/' ? 'Root' : selectedFolder;

  const openUploadQueue = useCallback(
    (fileList: FileList) => {
      const accepted: File[] = [];
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!config.mediaAllowedFormats.includes(ext)) {
          toast({ title: `Skipped "${file.name}" — format .${ext} not allowed`, variant: 'destructive' });
          continue;
        }
        accepted.push(file);
      }
      if (accepted.length > 0) setPendingUpload(accepted);
    },
    [config.mediaAllowedFormats],
  );

  const handleUploadComplete = useCallback(
    async (uploadedIds: string[]) => {
      // Cache invalidation happens inside `useUploadMedia` (called by
      // `MediaUploadDialog`), so the list refetches automatically.
      setPendingUpload(null);
      // Open the asset editor for the first upload — others are still in the list.
      if (uploadedIds.length > 0) {
        router.push(`/cms/media/${uploadedIds[0]}`);
      }
    },
    [router],
  );

  const handleCreateFolder = useCallback(
    (name: string) => {
      addCustomFolder(name);
      setSelectedFolder(name);
    },
    [addCustomFolder],
  );

  const confirmFolderDelete = useCallback(() => {
    if (!pendingFolderDelete) return;
    if ((countByFolder[pendingFolderDelete] ?? 0) > 0) {
      setPendingFolderDelete(null);
      return;
    }
    removeCustomFolder(pendingFolderDelete);
    if (selectedFolder === pendingFolderDelete) setSelectedFolder(null);
    setPendingFolderDelete(null);
  }, [pendingFolderDelete, countByFolder, removeCustomFolder, selectedFolder]);

  return (
    <div className="octo-media-manager">
      {/* Page header — mirrors DashboardContent */}
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-page-chrome__breadcrumb">
            <span className="octo-u-text-2">Media</span>
            {selectedFolder !== null && (
              <>
                <ChevronRight className="octo-icon-xs octo-u-opacity-60" />
                <span className="octo-u-text-2">{selectedFolder === '/' ? 'Root' : selectedFolder}</span>
              </>
            )}
          </div>
          <div className="octo-page-chrome__title-row">
            <h1 className="octo-page-chrome__title">{breadcrumbFolderLabel}</h1>
          </div>
        </div>
        <div className="octo-page-chrome__right octo-u-row octo-u-gap-2">
          <span className="octo-u-text-md octo-u-font-medium octo-u-text-2">
            Assets
            <span className="octo-u-mono octo-u-text-sm octo-u-text-muted" style={{ marginLeft: '6px' }}>
              {filteredFiles.length}
            </span>
          </span>
          <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
          <Button
            size="sm"
            className="octo-u-gap-1-5 octo-btn-primary-fg"
            onClick={() => document.getElementById('media-upload-bar-input')?.click()}
            disabled={pendingUpload !== null}
          >
            <Upload className="octo-icon-md" />
            Upload
          </Button>
        </div>
      </div>

      <div className="octo-media-manager__body">
        {isLoadingFiles ? (
          <MediaLeftPanelSkeleton />
        ) : (
          <MediaLeftPanel
            folders={folders}
            selectedFolder={selectedFolder}
            countByFolder={countByFolder}
            totalCount={files.length}
            customFolders={customFolders}
            onSelectAll={() => setSelectedFolder(null)}
            onSelectFolder={(f) => setSelectedFolder(f)}
            onAddFolder={() => setShowCreateFolder(true)}
            onDeleteFolder={(f) => setPendingFolderDelete(f)}
          />
        )}

        <div className="octo-media-manager__content">
          <MediaUploadBar
            allowedFormats={config.mediaAllowedFormats}
            onFiles={openUploadQueue}
            disabled={pendingUpload !== null}
          />

          {/* Search bar */}
          <div className="octo-media-manager__search-bar">
            <div className="octo-media-manager__search-wrap">
              <Search className="octo-media-manager__search-icon octo-icon-md" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter assets…"
                className="octo-media-manager__search-input"
              />
              <kbd className="octo-media-manager__search-kbd">/</kbd>
            </div>
          </div>

          <div className="octo-media-manager__scroll">
            {isLoadingFiles ? (
              viewMode === 'grid' ? (
                <MediaGridSkeleton />
              ) : (
                <MediaListTableSkeleton />
              )
            ) : filteredFiles.length === 0 ? (
              <div className="octo-media-manager__empty">
                <ImageIcon className="octo-icon-2xl" />
                <p className="octo-u-text-base">
                  {searchQuery ? 'No assets match this search' : 'No files in this folder yet'}
                </p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="octo-media-grid">
                {filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => router.push(`/cms/media/${file.id}`)}
                    className="octo-media-grid__card"
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
                ))}
              </div>
            ) : (
              <MediaListTable files={filteredFiles} />
            )}
          </div>
        </div>
      </div>

      {/* Hidden file input to back the topbar Upload button */}
      <input
        id="media-upload-bar-input"
        type="file"
        accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
        multiple
        className="octo-u-hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) openUploadQueue(e.target.files);
          e.target.value = '';
        }}
      />

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
        existing={folders.filter((f) => f !== '/')}
        onCreate={handleCreateFolder}
      />

      <DeleteFolderDialog
        folderName={pendingFolderDelete}
        fileCount={pendingFolderDelete ? (countByFolder[pendingFolderDelete] ?? 0) : 0}
        onConfirm={confirmFolderDelete}
        onCancel={() => setPendingFolderDelete(null)}
      />

      <MediaUploadDialog
        files={pendingUpload}
        defaultFolder={selectedFolder && selectedFolder !== '/' ? selectedFolder : '/'}
        onComplete={handleUploadComplete}
        onCancel={() => setPendingUpload(null)}
      />
    </div>
  );
};

function ViewModeSwitcher({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="octo-media-view-switcher" role="tablist" aria-label="View mode">
      <button
        type="button"
        role="tab"
        aria-selected={value === 'grid'}
        aria-label="Grid view"
        onClick={() => onChange('grid')}
        className={cn('octo-media-view-btn', value === 'grid' && 'octo-media-view-btn--active')}
      >
        <LayoutGrid className="octo-icon-sm" />
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === 'list'}
        aria-label="List view"
        onClick={() => onChange('list')}
        className={cn('octo-media-view-btn', value === 'list' && 'octo-media-view-btn--active')}
      >
        <List className="octo-icon-sm" />
      </button>
    </div>
  );
}

export default MediaManager;
