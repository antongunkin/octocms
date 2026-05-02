'use client';

import { ImageIcon, ChevronRight, LayoutGrid, List, Search, Upload } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { getMediaEntries, uploadMedia } from '../../admin/actions';
import { useConfig } from '../../hooks/useConfig';
import { useMediaCustomFolders } from '../../hooks/useMediaCustomFolders';
import { toast } from '../../hooks/useToast';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { cn } from '../../lib/utils';
import type { MediaFile } from '../../types';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';

import { CreateFolderDialog } from './CreateFolderDialog';
import { DeleteFolderDialog } from './DeleteFolderDialog';
import { MediaLeftPanel } from './MediaLeftPanel';
import { MediaListTable } from './MediaListTable';
import { MediaUploadBar } from './MediaUploadBar';

type MediaManagerProps = {
  files: MediaFile[];
};

type UploadRow = { file: File; title: string };
type ViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'octocms:media-view-mode';

const MediaManager = ({ files: initialFiles }: MediaManagerProps) => {
  const router = useRouter();
  const config = useConfig();
  const [files, setFiles] = useState(initialFiles);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadQueue, setUploadQueue] = useState<UploadRow[] | null>(null);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [pendingFolderDelete, setPendingFolderDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [isPending, startTransition] = useTransition();
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
      const rows: UploadRow[] = [];
      for (const file of Array.from(fileList)) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!config.mediaAllowedFormats.includes(ext)) {
          toast({ title: `Skipped "${file.name}" — format .${ext} not allowed`, variant: 'destructive' });
          continue;
        }
        rows.push({ file, title: suggestedTitleFromFileName(file.name) });
      }
      if (rows.length > 0) setUploadQueue(rows);
    },
    [config.mediaAllowedFormats],
  );

  const confirmUploadQueue = useCallback(() => {
    if (!uploadQueue?.length) return;
    for (const row of uploadQueue) {
      if (!row.title.trim()) {
        toast({ title: 'Each file needs a Title', variant: 'destructive' });
        return;
      }
    }

    const folder = selectedFolder && selectedFolder !== '/' ? selectedFolder : '/';
    const queue = uploadQueue;

    startTransition(async () => {
      for (const row of queue) {
        const formData = new FormData();
        formData.set('file', row.file);
        formData.set('folder', folder);
        formData.set('title', row.title.trim());

        const uploadResult = await uploadMedia(formData);
        if (!uploadResult.success) {
          toast({ title: uploadResult.error, variant: 'destructive' });
          return;
        }
      }

      const fresh = await getMediaEntries();
      setFiles(fresh);
      setUploadQueue(null);
      toast({ title: `Uploaded ${queue.length} file(s)`, variant: 'success' });
    });
  }, [uploadQueue, selectedFolder]);

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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header — mirrors DashboardContent */}
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="min-w-0 flex-1">
          <div className="mb-px flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
            <span style={{ color: 'var(--text-2)' }}>Media</span>
            {selectedFolder !== null && (
              <>
                <ChevronRight className="h-3 w-3 opacity-60" />
                <span style={{ color: 'var(--text-2)' }}>{selectedFolder === '/' ? 'Root' : selectedFolder}</span>
              </>
            )}
          </div>
          <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em] text-foreground">
            {breadcrumbFolderLabel}
          </h1>
        </div>
        <div className="flex flex-none items-center gap-2">
          <span className="text-[13px] font-medium text-[var(--text-2)]">
            Assets
            <span className="ml-1.5 font-mono text-[12px] font-normal text-[var(--muted)]">{filteredFiles.length}</span>
          </span>
          <ViewModeSwitcher value={viewMode} onChange={setViewMode} />
          <Button
            size="sm"
            className="gap-1.5 bg-foreground text-background hover:bg-foreground/90"
            onClick={() => document.getElementById('media-upload-bar-input')?.click()}
            disabled={isPending}
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
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

        <div className="flex flex-1 flex-col overflow-hidden">
          <MediaUploadBar allowedFormats={config.mediaAllowedFormats} onFiles={openUploadQueue} disabled={isPending} />

          {/* Search bar — same shape and tokens as /cms/content */}
          <div className="px-6 pb-3 pt-3">
            <div className="relative min-w-[220px] max-w-[420px] flex-[0_1_420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter assets…"
                className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-[var(--surface-2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                /
              </kbd>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {filteredFiles.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
                <ImageIcon className="h-12 w-12" />
                <p className="text-sm">{searchQuery ? 'No assets match this search' : 'No files in this folder yet'}</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
                {filteredFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => router.push(`/cms/media/${file.id}`)}
                    className="group relative cursor-pointer overflow-hidden rounded-xl border border-border bg-background text-left transition-all hover:border-foreground/40 hover:shadow-sm"
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
                      <p className="truncate text-sm font-medium text-foreground">{file.title || file.originalName}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
        className="hidden"
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

      <Dialog open={uploadQueue !== null} onOpenChange={(open) => !open && setUploadQueue(null)}>
        <DialogContent className="flex max-h-[85vh] max-w-lg flex-col">
          <DialogHeader>
            <DialogTitle>Set title for each image</DialogTitle>
            <DialogDescription>
              Titles are required and used as default alt text when this image is referenced in content.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 overflow-y-auto py-2 pr-1">
            {uploadQueue?.map((row, i) => (
              <div key={`${row.file.name}-${i}`} className="space-y-1.5">
                <p className="break-all text-xs text-muted-foreground">{row.file.name}</p>
                <Label className="sr-only text-xs" htmlFor={`upload-title-${i}`}>
                  Title
                </Label>
                <input
                  id={`upload-title-${i}`}
                  type="text"
                  value={row.title}
                  onChange={(e) => {
                    const v = e.target.value;
                    setUploadQueue((prev) => (prev ? prev.map((r, j) => (j === i ? { ...r, title: v } : r)) : prev));
                  }}
                  className="w-full rounded border border-border bg-background px-2 py-1.5 text-sm text-foreground"
                  disabled={isPending}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setUploadQueue(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmUploadQueue} disabled={isPending}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

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

export default MediaManager;
