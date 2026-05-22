'use client';

/**
 * Custom `ImageDialog` for the markdown editor's `imagePlugin`. Reuses the
 * existing `FormImageField` component (the same one the entry editor renders
 * for `image`-format fields) so the visual + interaction model is identical
 * across the CMS.
 *
 *   ┌────────── Insert image ──────────┐
 *   │                                  │
 *   │   [ FormImageField rendered      │
 *   │     here — preview area + the    │
 *   │     two action buttons ]         │
 *   │                                  │
 *   └──────────────────────────────────┘
 *
 * On pick (existing) or upload (new), the field's `onPick` / `onUpload`
 * callbacks fire with full info (MediaFile or staged File[] respectively),
 * we publish `saveImage$` to insert into the markdown body, and the realm
 * auto-closes the dialog.
 *
 * For the `'editing'` flow (user clicks the pencil on an inserted image)
 * we render a small alt-text editor — the image src is locked to a media
 * entry; to swap the image, delete it and re-insert.
 *
 * Drag-and-drop and paste-image flows still bypass this dialog entirely —
 * they go through `imageUploadHandler` in `FormMarkdownField.tsx`.
 */

import { useQueryClient } from '@tanstack/react-query';
import { closeImageDialog$, imageDialogState$, saveImage$ } from '@mdxeditor/editor';
import { useCellValues, usePublisher } from '@mdxeditor/gurx';
import React, { useState } from 'react';

import { queryKeys } from '../../admin/query/keys';
import { suggestedTitleFromFileName } from '../../lib/suggestedMediaTitle';
import type { MediaFile } from '../../types';
import FormImageField from '../FormImageField';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Label } from '../ui/label';

export const MarkdownInsertImageDialog: React.FC = () => {
  const queryClient = useQueryClient();
  const [state] = useCellValues(imageDialogState$);
  const publishSaveImage = usePublisher(saveImage$);
  const publishCloseImageDialog = usePublisher(closeImageDialog$);

  // Hooks always run — early-return below the hooks list keeps React happy.
  if (state.type === 'inactive') return null;

  if (state.type === 'editing') {
    return (
      <EditMarkdownImage initialAlt={state.initialValues.altText ?? ''} initialSrc={state.initialValues.src ?? ''} />
    );
  }

  // 'new' — toolbar-triggered insertion
  return (
    <InsertNewImage
      onPicked={(src, altText) => publishSaveImage({ src, altText, title: '' })}
      onCancel={() => publishCloseImageDialog()}
      onUploadComplete={async () => {
        // FormImageField already invalidates after upload, but the dialog
        // closes immediately on the first publish — re-invalidate so the
        // *next* "Select existing image" within this session is fresh.
        await queryClient.invalidateQueries({ queryKey: queryKeys.media.list() });
      }}
    />
  );
};

/**
 * "New image" body — a Dialog hosting `FormImageField`. The field's onPick
 * fires once per existing-asset selection; onUpload fires once per upload
 * batch with all uploaded ids + their staged Files (which carry the
 * extension we need to build `/media/<id>.<ext>` URLs).
 */
function InsertNewImage({
  onPicked,
  onCancel,
  onUploadComplete,
}: {
  onPicked: (src: string, altText: string) => void;
  onCancel: () => void;
  onUploadComplete: () => Promise<void> | void;
}) {
  const handlePick = (file: MediaFile) => {
    onPicked(file.publicUrl, file.title || file.originalName);
  };

  const handleUpload = (uploadedIds: string[], stagedFiles: File[]) => {
    for (let i = 0; i < uploadedIds.length; i++) {
      const id = uploadedIds[i];
      const file = stagedFiles[i];
      const ext = (file?.name.split('.').pop() || '').toLowerCase();
      onPicked(`/media/${id}.${ext}`, suggestedTitleFromFileName(file?.name || ''));
    }
    void onUploadComplete();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Radix only fires this on user-initiated close (X / Esc / overlay).
        if (!open) onCancel();
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Insert image</DialogTitle>
        </DialogHeader>
        <FormImageField
          label="Image"
          name="markdown-insert-image"
          value=""
          onPick={handlePick}
          onUpload={handleUpload}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * "Edit image" body — alt-text editor. The src is locked (you can't change
 * the source of an inserted image without picking a new one; for that, just
 * delete and re-insert).
 */
function EditMarkdownImage({ initialAlt, initialSrc }: { initialAlt: string; initialSrc: string }) {
  const [altText, setAltText] = useState(initialAlt);
  const publishSaveImage = usePublisher(saveImage$);
  const publishCloseImageDialog = usePublisher(closeImageDialog$);

  const handleSave = () => {
    // saveImage$ in editing mode pulls nodeKey from imageDialogState$ and
    // updates the existing image node's alt/title/src. We keep src as-is.
    publishSaveImage({ src: initialSrc, altText, title: '' });
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) publishCloseImageDialog();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit image</DialogTitle>
        </DialogHeader>
        <div className="octo-u-stack octo-u-gap-4 octo-u-py-2">
          {initialSrc ? (
            <div className="octo-markdown-dialog__preview">
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img src={initialSrc} alt={altText} className="octo-markdown-dialog__preview-img" />
            </div>
          ) : null}
          <div className="octo-markdown-dialog__alt-field">
            <Label htmlFor="markdown-edit-image-alt">Alt text</Label>
            <input
              id="markdown-edit-image-alt"
              type="text"
              value={altText}
              onChange={(e) => setAltText(e.target.value)}
              className="octo-markdown-dialog__alt-input"
              placeholder="Describe this image"
            />
            <p className="octo-markdown-dialog__alt-hint">
              Used by screen readers and shown if the image fails to load. To replace the image, delete it and insert a
              new one.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => publishCloseImageDialog()}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
