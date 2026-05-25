'use client';

import { ArrowLeft, ChevronRight, ExternalLink, ImageIcon, Trash2 } from '../ui/icons';
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

export default function MediaAsset({ id }: MediaAssetProps) {
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
      <div className="octo-media-asset">
        <div className="octo-page-chrome">
          <div className="octo-u-row octo-u-gap-2">
            <Button variant="ghost" size="icon" className="octo-btn-back" onClick={back} aria-label="Back to media">
              <ArrowLeft className="octo-icon-md" />
            </Button>
          </div>
        </div>
        <div className="octo-media-asset__body">
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
      <div className="octo-media-asset__not-found">
        <ImageIcon className="octo-icon-2xl" />
        <p className="octo-u-text-base">Asset not found.</p>
        <Button variant="outline" onClick={back}>
          Back to media
        </Button>
      </div>
    );
  }

  const folderLabel = file.folder === '/' ? 'Root' : file.folder;

  return (
    <div className="octo-media-asset">
      {/* Page header — same chrome as content list */}
      <div className="octo-page-chrome">
        <div className="octo-page-chrome__title-area">
          <div className="octo-u-row octo-u-gap-2">
            <Button variant="ghost" size="icon" className="octo-btn-back" onClick={back} aria-label="Back to media">
              <ArrowLeft className="octo-icon-md" />
            </Button>
            <div>
              <div className="octo-page-chrome__breadcrumb">
                <button type="button" onClick={back} className="octo-btn-breadcrumb">
                  Media
                </button>
                <ChevronRight className="octo-icon-xs octo-u-opacity-60" />
                <span className="octo-u-text-2">{folderLabel}</span>
              </div>
              <div className="octo-page-chrome__title-row">
                <h1 className="octo-page-chrome__title">{file.title || file.originalName}</h1>
              </div>
            </div>
          </div>
        </div>
        <div className="octo-page-chrome__right octo-u-row octo-u-gap-2">
          <Button variant="outline" className="octo-u-gap-1-5" onClick={openInNewTab}>
            <ExternalLink className="octo-icon-md" />
            Open in new tab
          </Button>
          <Button
            variant="ghost"
            className="octo-button octo-button--danger-ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={isPending}
          >
            <Trash2 className="octo-icon-md" />
            Delete
          </Button>
        </div>
      </div>

      <div className="octo-media-asset__body">
        {/* Preview pane */}
        <div className="octo-media-asset__preview">
          <img src={file.publicUrl} alt={file.title || file.originalName} className="octo-media-asset__preview-img" />
        </div>

        {/* Sidebar form */}
        <aside className="octo-media-asset__sidebar">
          <div className="octo-media-asset__sidebar-inner">
            <section className="octo-media-asset__sidebar-section">
              <Label htmlFor="media-asset-title" className="octo-field-label-hint">
                Title <span className="octo-u-text-danger">*</span>
              </Label>
              <input
                id="media-asset-title"
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                disabled={isPending}
                placeholder="Used as alt text when this image is referenced"
                className="octo-media-asset__input"
              />
              <Button
                type="button"
                variant="secondary"
                className="octo-button octo-button--w-full"
                onClick={handleSaveTitle}
                disabled={isPending || titleDraft.trim() === file.title}
              >
                Save title
              </Button>
            </section>

            <section className="octo-media-asset__sidebar-section">
              <Label htmlFor="media-asset-folder" className="octo-field-label-hint">
                Folder
              </Label>
              <Select value={folderDraft} onValueChange={setFolderDraft} disabled={isPending}>
                <SelectTrigger id="media-asset-folder">
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
                variant="secondary"
                className="octo-button octo-button--w-full"
                onClick={handleSaveFolder}
                disabled={isPending || folderDraft === file.folder}
              >
                Save folder
              </Button>
              <p className="octo-u-text-xs octo-u-text-muted">
                Folders are virtual labels for sorting &mdash; they aren&rsquo;t physical directories.
              </p>
            </section>

            <section className="octo-media-asset__details-section">
              <h3 className="octo-media-asset__details-heading">Details</h3>
              <div className="octo-media-asset__details">
                <DetailRow label="File name" value={file.originalName} mono />
                <DetailRow label="Format" value={file.extension.toUpperCase()} />
                {file.width != null && file.height != null && (
                  <DetailRow label="Dimensions" value={`${file.width} × ${file.height}`} />
                )}
                <DetailRow label="Path" value={file.publicUrl} mono />
                <DetailRow label="ID" value={file.id} mono />
              </div>
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
    <div className="octo-media-asset__detail">
      <span className="octo-media-asset__detail-label">{label}</span>
      <span
        className={cn(
          'octo-media-asset__detail-value',
          mono && 'octo-media-asset__detail-value octo-media-asset__detail-value--mono',
        )}
      >
        {value}
      </span>
    </div>
  );
}
