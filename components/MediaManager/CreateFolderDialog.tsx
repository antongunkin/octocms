'use client';

import React, { useEffect, useState } from 'react';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
} from '../ui';

export type CreateFolderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existing: string[];
  onCreate: (name: string) => void;
};

export function sanitizeFolderName(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9_-]/g, '-');
}

export function CreateFolderDialog({ open, onOpenChange, existing, onCreate }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setError(null);
    }
  }, [open]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const sanitized = sanitizeFolderName(name);
    if (!sanitized) {
      setError('Folder name is required');
      return;
    }
    if (existing.includes(sanitized)) {
      setError(`Folder "${sanitized}" already exists`);
      return;
    }
    onCreate(sanitized);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription>
              Folders are virtual labels for sorting your assets. They aren&rsquo;t physical directories.
            </DialogDescription>
          </DialogHeader>
          <div className="octo-folder-dialog__body">
            <Label htmlFor="new-folder-name" className="octo-field-label-hint">
              Folder name
            </Label>
            <input
              id="new-folder-name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              placeholder="e.g. blog-posts"
              className="octo-folder-dialog__input"
            />
            {error && <p className="octo-folder-dialog__error">{error}</p>}
            <p className="octo-folder-dialog__hint">
              Allowed: letters, digits, dashes, underscores. Other characters become &ldquo;-&rdquo;.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Create folder</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
