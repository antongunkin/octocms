'use client';

import { ArrowLeft, ChevronRight, ExternalLink, ImageIcon, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useMediaAsset } from '../../admin/query/hooks/useMediaAsset';
import { useDeleteMedia, useMoveMedia, useUpdateMediaMetadata } from '../../admin/query/hooks/useMediaMutations';
import { useMediaCustomFolders } from '../../hooks/useMediaCustomFolders';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';

import { MediaMetadataFormSkeleton } from './skeletons/MediaMetadataFormSkeleton';
import { MediaPreviewSkeleton } from './skeletons/MediaPreviewSkeleton';

export type MediaAssetProps = {
  id: string;
};

export function MediaAsset({ id }: MediaAssetProps) {
  const router = useRouter();
  const { asset: file, allFiles, isLoading } = useMediaAsset(id);
  const updateMetadataMutation = useUpdateMediaMetadata();
  const moveMutation = useMoveMedia();
  const deleteMutation = useDeleteMedia();
  const isPending = updateMetadataMutation.isPending || moveMutation.isPending || deleteMutation.isPending;

  const [titleDraft, setTitleDraft] = useState('');
  const [folderDraft, setFolderDraft] = useState('/');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { folders: customFolders } = useMediaCustomFolders();

  // Sync local drafts whenever the resolved asset changes (initial load,
  // navigating between assets, or external invalidation).
  useEffect(() => {
    if (file) {
      setTitleDraft(file.title);
      setFolderDraft(file.folder);
    }
  }, [file]);

  const folders = useMemo(() => {
    const fromFiles = Array.from(new Set(allFiles.map((f) => f.folder).filter((f) => f !== '/')));
    const combined = Array.from(new Set([...fromFiles, ...customFolders])).sort();
    return ['/', ...combined];
  }, [allFiles, customFolders]);

  const back = useCallback(() => router.push('/cms/media'), [router]);

  const handleSaveTitle = useCallback(async () => {
    if (!file) return;
    const next = titleDraft.trim();
    if (!next) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    if (next === file.title) return;
    try {
      await updateMetadataMutation.mutateAsync({ id: file.id, title: next });
      toast({ title: 'Title saved', variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Save failed', variant: 'destructive' });
    }
  }, [file, titleDraft, updateMetadataMutation]);

  const handleSaveFolder = useCallback(async () => {
    if (!file || folderDraft === file.folder) return;
    const next = folderDraft;
    try {
      await moveMutation.mutateAsync({ id: file.id, folder: next });
      toast({ title: `Moved to ${next === '/' ? 'Root' : next}`, variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Move failed', variant: 'destructive' });
    }
  }, [file, folderDraft, moveMutation]);

  const handleDelete = useCallback(async () => {
    if (!file) return;
    try {
      await deleteMutation.mutateAsync(file.id);
      toast({ title: `Deleted "${file.originalName}"`, variant: 'success' });
      router.push('/cms/media');
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Delete failed', variant: 'destructive' });
      setConfirmDelete(false);
    }
  }, [file, deleteMutation, router]);

  const openInNewTab = useCallback(() => {
    if (!file) return;
    window.open(file.publicUrl, '_blank', 'noopener,noreferrer');
  }, [file]);

  // Loading state — pre-skeleton render: keep header chrome but render block
  // skeletons so chip widths stay stable while the list resolves.
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="-ml-2 h-7 w-7 text-muted-foreground"
              onClick={back}
              aria-label="Back to media"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <MediaPreviewSkeleton />
          <MediaMetadataFormSkeleton />
        </div>
      </div>
    );
  }

  // Resolved but no match — empty state instead of server-side `notFound()`
  // so navigation between assets stays inside the cached SPA.
  if (!file) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
        <ImageIcon className="h-12 w-12" />
        <p className="text-sm">Asset not found.</p>
        <Button variant="outline" size="sm" onClick={back}>
          Back to media
        </Button>
      </div>
    );
  }

  const folderLabel = file.folder === '/' ? 'Root' : file.folder;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header — same chrome as content list */}
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 h-7 w-7 text-muted-foreground"
            onClick={back}
            aria-label="Back to media"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <div className="mb-px flex items-center gap-1.5 text-[12px] text-[var(--muted)]">
              <button
                type="button"
                onClick={back}
                className="text-[var(--text-2)] hover:text-foreground"
                style={{ color: 'var(--text-2)' }}
              >
                Media
              </button>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <span style={{ color: 'var(--text-2)' }}>{folderLabel}</span>
            </div>
            <h1 className="m-0 overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em] text-foreground">
              {file.title || file.originalName}
            </h1>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openInNewTab}>
            <ExternalLink className="h-4 w-4" />
            Open in new tab
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Preview pane */}
        <div className="flex flex-1 items-center justify-center overflow-auto bg-[var(--surface-2)] p-8">
          <img
            src={file.publicUrl}
            alt={file.title || file.originalName}
            className="max-h-full max-w-full rounded-lg border border-border bg-background object-contain shadow-sm"
          />
        </div>

        {/* Sidebar form */}
        <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background">
          <div className="space-y-6 px-5 py-5">
            <section className="space-y-1.5">
              <Label htmlFor="media-asset-title" className="text-xs text-muted-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <input
                id="media-asset-title"
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={isPending}
                placeholder="Used as alt text when this image is referenced"
                className={cn(
                  'w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
              />
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={handleSaveTitle}
                disabled={isPending || titleDraft.trim() === file.title}
              >
                Save title
              </Button>
            </section>

            <section className="space-y-1.5">
              <Label htmlFor="media-asset-folder" className="text-xs text-muted-foreground">
                Folder
              </Label>
              <Select value={folderDraft} onValueChange={setFolderDraft} disabled={isPending}>
                <SelectTrigger
                  id="media-asset-folder"
                  className="h-9 w-full rounded-lg border-border text-sm font-normal"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {folders.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f === '/' ? 'Root' : f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={handleSaveFolder}
                disabled={isPending || folderDraft === file.folder}
              >
                Save folder
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Folders are virtual labels for sorting &mdash; they aren&rsquo;t physical directories.
              </p>
            </section>

            <section className="space-y-2.5 border-t border-border pt-5 text-sm">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Details</h3>
              <DetailRow label="File name" value={file.originalName} mono />
              <DetailRow label="Format" value={file.extension.toUpperCase()} />
              {file.width != null && file.height != null && (
                <DetailRow label="Dimensions" value={`${file.width} × ${file.height}`} />
              )}
              <DetailRow label="Path" value={file.publicUrl} mono />
              <DetailRow label="ID" value={file.id} mono />
            </section>
          </div>
        </aside>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &ldquo;{file.originalName}&rdquo;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={isPending}>
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
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="w-24 flex-none text-xs text-muted-foreground">{label}</span>
      <span className={cn('break-all text-xs text-foreground', mono && 'font-mono')}>{value}</span>
    </div>
  );
}
