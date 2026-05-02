'use client';

import React from 'react';

import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export type DeleteFolderDialogProps = {
  folderName: string | null;
  fileCount: number;
  onConfirm: () => void;
  onCancel: () => void;
};

export function DeleteFolderDialog({ folderName, fileCount, onConfirm, onCancel }: DeleteFolderDialogProps) {
  const open = folderName !== null;
  const blocked = fileCount > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete folder</DialogTitle>
          <DialogDescription>
            {blocked ? (
              <>
                <strong>&ldquo;{folderName}&rdquo;</strong> still contains {fileCount} file{fileCount === 1 ? '' : 's'}.
                Move them to another folder before deleting.
              </>
            ) : (
              <>
                Remove the folder <strong>&ldquo;{folderName}&rdquo;</strong>? Assets aren&rsquo;t deleted &mdash; only
                the folder label disappears from your sidebar.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={blocked}>
            Delete folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
