'use client';

/**
 * Per-file upload-queue dialog. Pure presentation + queue management — the
 * caller hands in the staged `File[]`, this component runs the per-file
 * Title + "Generate blur placeholder" pass and calls `uploadMedia` once
 * per row. Used both by the standalone `/cms/media` library and by
 * `FormImageField`'s "Upload new image" flow inside the entry editor.
 */

import React, { useEffect, useState, useTransition } from 'react';

import { useUploadMedia } from '../../admin/query/hooks/useMediaMutations';
import { toast } from '../../hooks/useToast';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';

type UploadRow = { file: File; title: string; generateBlur: boolean };

type MediaUploadDialogProps = {
  /** Files staged for upload. `null` keeps the dialog closed. */
  files: File[] | null;
  /** Folder all files in this batch are filed under. `'/'` for root. */
  defaultFolder: string;
  /** Fires once per successful batch with every uploaded media id, in order. */
  onComplete: (uploadedIds: string[]) => void;
  /** Fires when the user cancels (X button, Cancel button, or Esc). */
  onCancel: () => void;
};

export function MediaUploadDialog({ files, defaultFolder, onComplete, onCancel }: MediaUploadDialogProps) {
  const [rows, setRows] = useState<UploadRow[]>([]);
  const [isPending, startTransition] = useTransition();
  const uploadMutation = useUploadMedia();

  // Re-seed rows whenever the caller hands us a fresh `files` array.
  useEffect(() => {
    if (!files) {
      setRows([]);
      return;
    }
    setRows(files.map((file) => ({ file, title: suggestedTitleFromFileName(file.name), generateBlur: true })));
  }, [files]);

  const handleConfirm = () => {
    if (!rows.length) return;
    for (const row of rows) {
      if (!row.title.trim()) {
        toast({ title: 'Each file needs a Title', variant: 'destructive' });
        return;
      }
    }

    startTransition(async () => {
      const uploadedIds: string[] = [];
      for (const row of rows) {
        const formData = new FormData();
        formData.set('file', row.file);
        formData.set('folder', defaultFolder);
        formData.set('title', row.title.trim());
        formData.set('generateBlur', row.generateBlur ? '1' : '0');

        try {
          const uploadResult = await uploadMutation.mutateAsync(formData);
          uploadedIds.push(uploadResult.id);
        } catch (e) {
          toast({ title: e instanceof Error ? e.message : 'Upload failed', variant: 'destructive' });
          return;
        }
      }

      toast({ title: `Uploaded ${rows.length} file(s)`, variant: 'success' });
      onComplete(uploadedIds);
    });
  };

  return (
    <Dialog open={files !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="octo-dialog-content--lg octo-dialog-content--vh-85 octo-dialog-content--flex-col">
        <DialogHeader>
          <DialogTitle>Set title for each image</DialogTitle>
          <DialogDescription>
            Titles are required and used as default alt text when this image is referenced in content.
          </DialogDescription>
        </DialogHeader>
        <div className="octo-upload-dialog__rows">
          {rows.map((row, i) => (
            <div key={`${row.file.name}-${i}`} className="octo-upload-dialog__row">
              <p className="octo-upload-dialog__filename">{row.file.name}</p>
              <Label className="octo-field-label" htmlFor={`upload-title-${i}`}>
                Title
              </Label>
              <input
                id={`upload-title-${i}`}
                type="text"
                value={row.title}
                onChange={(e) => {
                  const v = e.target.value;
                  setRows((prev) => prev.map((r, j) => (j === i ? { ...r, title: v } : r)));
                }}
                className="octo-upload-dialog__input"
                disabled={isPending}
              />
              <label className="octo-upload-dialog__blur-label">
                <input
                  type="checkbox"
                  checked={row.generateBlur}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, generateBlur: checked } : r)));
                  }}
                  style={{ height: '14px', width: '14px', borderRadius: '3px' }}
                  disabled={isPending}
                />
                Generate blur placeholder
              </label>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={isPending}>
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
