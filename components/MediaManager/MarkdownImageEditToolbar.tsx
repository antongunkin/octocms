'use client';

/**
 * Custom `EditImageToolbar` for the markdown editor's `imagePlugin`.
 *
 * Replaces the default toolbar (which deletes images on a single click with
 * no undo affordance — see `node_modules/@mdxeditor/editor/dist/plugins/image/EditImageToolbar.js`).
 * The Edit button still publishes `openEditImageDialog$` so our custom
 * `MarkdownInsertImageDialog` picks it up in its `'editing'` branch.
 *
 * Delete now opens a small confirmation dialog: the user must explicitly
 * confirm before the Lexical node is removed. The lexical mutation is the
 * same as the default — `$getNodeByKey(nodeKey)?.remove()` inside an
 * `editor.update`.
 */

import { openEditImageDialog$, parseImageDimension } from '@mdxeditor/editor';
import { usePublisher } from '@mdxeditor/gurx';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getNodeByKey } from 'lexical';
import { Icon } from '../ui/icons';
import React, { useState } from 'react';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

type Props = {
  nodeKey: string;
  imageSource: string;
  initialImagePath: string | null;
  title: string;
  alt: string;
  width?: number | 'inherit';
  height?: number | 'inherit';
};

export const MarkdownImageEditToolbar: React.FC<Props> = ({
  nodeKey,
  imageSource,
  initialImagePath,
  title,
  alt,
  width,
  height,
}) => {
  const [editor] = useLexicalComposerContext();
  const openEditImageDialog = usePublisher(openEditImageDialog$);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirmDelete = () => {
    editor.update(() => {
      $getNodeByKey(nodeKey)?.remove();
    });
    setConfirmOpen(false);
  };

  return (
    <div className="octo-markdown-img-toolbar">
      <button
        type="button"
        title="Delete image"
        aria-label="Delete image"
        onClick={(e) => {
          e.preventDefault();
          setConfirmOpen(true);
        }}
        className="octo-markdown-img-toolbar__btn octo-markdown-img-toolbar__btn--delete"
      >
        <Icon.Trash2 className="octo-icon-sm" />
      </button>
      <button
        type="button"
        title="Edit image"
        aria-label="Edit image"
        onClick={() => {
          openEditImageDialog({
            nodeKey,
            initialValues: {
              src: initialImagePath ?? imageSource,
              title,
              altText: alt,
              width: parseImageDimension(width),
              height: parseImageDimension(height),
            },
          });
        }}
        className="octo-markdown-img-toolbar__btn octo-markdown-img-toolbar__btn--edit"
      >
        <Icon.Pencil className="octo-icon-sm" />
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="octo-dialog-content octo-dialog-content--md">
          <DialogHeader>
            <DialogTitle>Delete this image?</DialogTitle>
            <DialogDescription>
              The image will be removed from the markdown body. This won't delete the asset from your media library —
              you can re-insert it any time.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
