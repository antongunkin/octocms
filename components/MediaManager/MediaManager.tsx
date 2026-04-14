'use client';

import { Check, Copy, FolderOpen, ImageIcon, MoreHorizontal, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { deleteMedia, getMediaEntries, moveMedia, updateMediaMetadata, uploadMedia } from '../../admin/actions';
import { useConfig } from '../../hooks/useConfig';
import { toast } from '../../hooks/useToast';
import type { MediaFile } from '../../types';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui';
import { Label } from '../ui/label';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';

type MediaManagerProps = {
  files: MediaFile[];
  /** When set (e.g. from `/cms/media/<id>`), open that asset in the detail panel. */
  initialMediaId?: string;
};

/** Match dashboard / legacy URLs: id or `media-<id>` filename stem. */
function findMediaFileByRequestedId(requested: string, list: MediaFile[]): MediaFile | undefined {
  const trimmed = requested.trim();
  const direct = list.find((f) => f.id === trimmed);
  if (direct) return direct;
  if (trimmed.startsWith('media-')) {
    const stripped = trimmed.slice('media-'.length);
    return list.find((f) => f.id === stripped);
  }
  return undefined;
}

type UploadRow = { file: File; title: string };

const MediaManager = ({ files: initialFiles, initialMediaId }: MediaManagerProps) => {
  const config = useConfig();
  const [files, setFiles] = useState(initialFiles);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const lastInitialMediaIdRef = useRef<string | undefined>(undefined);
  const didApplyDeepLinkRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<UploadRow[] | null>(null);
  const [titleDraft, setTitleDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const folders = useMemo(() => {
    const allFolders = files.map((f) => f.folder);
    const fromFiles = allFolders.filter((f, i) => f !== '/' && allFolders.indexOf(f) === i);
    const combined = [...new Set([...fromFiles, ...customFolders])];
    return ['/', ...combined.sort()];
  }, [files, customFolders]);

  const filteredFiles = useMemo(() => {
    let result =
      selectedFolder === null || selectedFolder === '/'
        ? files.filter((f) => f.folder === '/')
        : files.filter((f) => f.folder === selectedFolder);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) => f.originalName.toLowerCase().includes(q) || (f.title ?? '').toLowerCase().includes(q),
      );
    }

    return result;
  }, [files, selectedFolder, searchQuery]);

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
      if (rows.length > 0) {
        setUploadQueue(rows);
      }
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

  useEffect(() => {
    setTitleDraft(selectedFile?.title ?? '');
  }, [selectedFile?.id, selectedFile?.title]);

  useEffect(() => {
    const raw = initialMediaId?.trim();

    if (raw !== lastInitialMediaIdRef.current) {
      lastInitialMediaIdRef.current = raw;
      didApplyDeepLinkRef.current = false;
    }

    if (!raw || didApplyDeepLinkRef.current) return;

    const file = findMediaFileByRequestedId(raw, files);
    if (!file) return;

    didApplyDeepLinkRef.current = true;
    setSelectedFolder(file.folder === '/' ? '/' : file.folder);
    setSelectedFile(file);
  }, [initialMediaId, files]);

  const saveTitle = useCallback(() => {
    if (!selectedFile) return;
    const next = titleDraft.trim();
    if (!next) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const result = await updateMediaMetadata(selectedFile.id, next);
      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }
      setFiles((prev) => prev.map((f) => (f.id === selectedFile.id ? { ...f, title: next } : f)));
      setSelectedFile((prev) => (prev && prev.id === selectedFile.id ? { ...prev, title: next } : prev));
      toast({ title: 'Title saved', variant: 'success' });
    });
  }, [selectedFile, titleDraft]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    startTransition(async () => {
      try {
        const result = await deleteMedia(deleteTarget.id);

        if (!result.success) {
          toast({ title: result.error, variant: 'destructive' });
          return;
        }

        setFiles((prev) => prev.filter((f) => f.id !== deleteTarget.id));

        if (selectedFile?.id === deleteTarget.id) {
          setSelectedFile(null);
        }

        toast({ title: `Deleted "${deleteTarget.originalName}"`, variant: 'success' });
      } finally {
        setDeleteTarget(null);
      }
    });
  }, [deleteTarget, selectedFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files.length > 0) {
        openUploadQueue(e.dataTransfer.files);
      }
    },
    [openUploadQueue],
  );

  const copyPath = useCallback((publicUrl: string) => {
    navigator.clipboard.writeText(publicUrl);
    setCopiedPath(true);
    setTimeout(() => setCopiedPath(false), 2000);
  }, []);

  const handleMove = useCallback(
    (mediaId: string, newFolder: string) => {
      startTransition(async () => {
        const result = await moveMedia(mediaId, newFolder);

        if (!result.success) {
          toast({ title: result.error, variant: 'destructive' });
          return;
        }

        setFiles((prev) => prev.map((f) => (f.id === mediaId ? { ...f, folder: newFolder } : f)));

        if (selectedFile?.id === mediaId) {
          setSelectedFile((prev) => (prev ? { ...prev, folder: newFolder } : prev));
        }

        toast({ title: `Moved to ${newFolder === '/' ? 'Root' : newFolder}`, variant: 'success' });
      });
    },
    [selectedFile],
  );

  const handleCreateFolder = useCallback(() => {
    const name = newFolderName.trim().replace(/[^a-zA-Z0-9_-]/g, '-');

    if (!name) return;

    setCustomFolders((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSelectedFolder(name);
    setNewFolderName('');
    setShowNewFolder(false);
  }, [newFolderName]);

  const handleDeleteFolder = useCallback(
    (folderName: string) => {
      const hasFiles = files.some((f) => f.folder === folderName);

      if (hasFiles) {
        toast({ title: 'Cannot delete folder: move images first', variant: 'destructive' });
        return;
      }

      setCustomFolders((prev) => prev.filter((f) => f !== folderName));

      if (selectedFolder === folderName) {
        setSelectedFolder('/');
      }
    },
    [files, selectedFolder],
  );

  return (
    <div className="flex flex-1 w-full">
      {/* Sidebar — folders */}
      <div className="w-56 flex-none bg-background border-r border-border flex flex-col overflow-y-auto">
        <div className="p-2">
          <div className="flex items-center px-2 mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex-1">Folders</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 -mr-1 text-muted-foreground"
              onClick={() => setShowNewFolder(!showNewFolder)}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
          {showNewFolder && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateFolder();
              }}
              className="flex gap-1 mb-1"
            >
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="folder-name"
                className="flex-1 text-sm px-2 py-1 rounded border border-border bg-background"
              />
              <Button type="submit" size="sm" variant="outline" className="h-7 px-2 text-xs">
                Add
              </Button>
            </form>
          )}
          <nav className="space-y-0.5">
            {folders.map((folder) => (
              <div key={folder} className="flex items-center group">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolder(folder);
                    setSelectedFile(null);
                  }}
                  className={cn(
                    'h-8 flex items-center gap-2 flex-1 text-left px-2 rounded-md text-sm transition-colors',
                    (selectedFolder ?? '/') === folder
                      ? 'bg-accent text-accent-foreground'
                      : 'text-foreground hover:bg-accent',
                  )}
                >
                  <FolderOpen className="w-4 h-4 flex-none" />
                  {folder === '/' ? 'Root' : folder}
                  <span className="ml-auto text-xs opacity-60">{files.filter((f) => f.folder === folder).length}</span>
                </button>
                {folder !== '/' && (
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(folder)}
                    className="hidden group-hover:flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-destructive flex-none"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </nav>
        </div>
      </div>

      {/* Main content — grid + detail */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toolbar — title + upload */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background">
          <div className="mr-auto">
            <h1 className="text-xl font-semibold text-foreground">
              {selectedFolder && selectedFolder !== '/' ? `/${selectedFolder}` : 'Media'}
            </h1>
            <p className="text-xs text-muted-foreground">{filteredFiles.length} assets</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={config.mediaAllowedFormats.map((f) => `.${f}`).join(',')}
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) openUploadQueue(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            variant="default"
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPending}
          >
            <Upload className="w-4 h-4" />
            Upload
          </Button>
        </div>

        {/* Filter bar — search */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Grid */}
          <div
            className={cn(
              'flex-1 overflow-y-auto p-6 transition-colors',
              isDragging && 'bg-accent/40 ring-2 ring-inset ring-primary/40',
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {filteredFiles.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
                {filteredFiles.map((file) => (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setSelectedFile(file)}
                    tabIndex={0}
                    className={cn(
                      'group relative rounded-lg overflow-hidden border transition-all cursor-pointer',
                      selectedFile?.id === file.id
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'border-border hover:border-primary/50',
                    )}
                  >
                    {/* Hover actions menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1.5 top-1.5 z-10 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            copyPath(file.publicUrl);
                          }}
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy URL
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(file);
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <div className="aspect-square bg-muted/50">
                      <img
                        src={file.publicUrl}
                        alt={file.title || file.originalName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="px-3 py-2 bg-background border-t border-border">
                      <p className="text-sm font-medium truncate text-foreground">{file.title || file.originalName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {file.extension.toUpperCase()}
                        {file.width != null && file.height != null ? ` · ${file.width}×${file.height}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-3">
                <ImageIcon className="w-12 h-12" />
                <p className="text-sm">{isDragging ? 'Drop files here to upload' : 'No files in this folder'}</p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4" />
                  Upload files
                </Button>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedFile && (
            <div className="w-80 flex-none border-l border-border bg-background flex flex-col overflow-hidden">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-none">
                <h2 className="text-sm font-medium text-foreground">Asset details</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground"
                  onClick={() => setSelectedFile(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Preview */}
                <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
                  <img
                    src={selectedFile.publicUrl}
                    alt={selectedFile.title || selectedFile.originalName}
                    className="w-full h-48 object-contain"
                  />
                </div>

                {/* Quick actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => copyPath(selectedFile.publicUrl)}
                  >
                    {copiedPath ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedPath ? 'Copied!' : 'Copy URL'}
                  </Button>
                </div>

                {/* Title edit */}
                <div className="space-y-1.5">
                  <Label htmlFor="media-detail-title" className="text-xs text-muted-foreground">
                    Title <span className="text-destructive">*</span>
                  </Label>
                  <input
                    id="media-detail-title"
                    type="text"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    disabled={isPending}
                    className="w-full text-sm px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Alt text when used in content"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={saveTitle}
                    disabled={isPending}
                  >
                    Save title
                  </Button>
                </div>

                {/* File info rows */}
                <div className="space-y-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 flex-none text-xs">File name</span>
                    <span className="text-foreground break-all text-xs">{selectedFile.originalName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 flex-none text-xs">Folder</span>
                    <span className="text-foreground text-xs">
                      {selectedFile.folder === '/' ? 'Root' : selectedFile.folder}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground w-20 flex-none text-xs">Format</span>
                    <span className="text-foreground uppercase text-xs">{selectedFile.extension}</span>
                  </div>
                  {selectedFile.width != null && selectedFile.height != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground w-20 flex-none text-xs">Dimensions</span>
                      <span className="text-foreground text-xs">
                        {selectedFile.width} × {selectedFile.height}
                      </span>
                    </div>
                  )}
                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground w-20 flex-none text-xs">Path</span>
                    <span className="text-foreground break-all font-mono text-xs">{selectedFile.publicUrl}</span>
                  </div>
                </div>

                {/* Move to folder */}
                <div className="space-y-1.5">
                  <span className="block text-xs text-muted-foreground">Move to folder</span>
                  <select
                    value={selectedFile.folder}
                    onChange={(e) => handleMove(selectedFile.id, e.target.value)}
                    disabled={isPending}
                    className="w-full text-sm px-2 py-1.5 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {folders.map((f) => (
                      <option key={f} value={f}>
                        {f === '/' ? 'Root' : f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Panel footer */}
              <div className="flex items-center justify-between border-t border-border px-4 py-3 flex-none">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setDeleteTarget(selectedFile)}
                  disabled={isPending}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Dialog open={uploadQueue !== null} onOpenChange={(open) => !open && setUploadQueue(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Set title for each image</DialogTitle>
            <DialogDescription>
              Titles are required and used as default alt text when this image is referenced in content.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto space-y-4 py-2 pr-1">
            {uploadQueue?.map((row, i) => (
              <div key={`${row.file.name}-${i}`} className="space-y-1.5">
                <p className="text-xs text-muted-foreground break-all">{row.file.name}</p>
                <Label className="text-xs sr-only" htmlFor={`upload-title-${i}`}>
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
                  className="w-full text-sm px-2 py-1.5 rounded border border-border bg-background text-foreground"
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

      {/* Delete confirmation dialog */}
      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{deleteTarget?.originalName}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaManager;
