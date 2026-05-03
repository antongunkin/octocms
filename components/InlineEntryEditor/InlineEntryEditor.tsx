'use client';

import { ArrowLeft, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { useEntry } from '../../admin/query/hooks/useEntry';
import { useEntryBacklinks } from '../../admin/query/hooks/useEntryBacklinks';
import {
  useArchiveEntry,
  usePublishEntry,
  useRemoveFile,
  useRestoreEntry,
  useSaveFile,
} from '../../admin/query/hooks/useEntryMutations';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
import { useIsProduction } from '../../admin/query/hooks/useIsProduction';
import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryStack } from '../../hooks/useEntryStack';
import { toast } from '../../hooks/useToast';
import { toReferenceKey } from '../../lib/referenceKeys';
import { validateEntryFields } from '../../lib/validateEntryFields';
import type { EntryStatus } from '../../types';
import { StatusBadge } from '../StatusBadge';

import FormFields from '../FormFields';
import LinkedBySection from '../LinkedBySection/LinkedBySection';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui';
import CreateBranchDialog from '../CreateBranchDialog';

type InlineEntryEditorProps = {
  entryPath: string;
  entryType: string;
  entryId: string;
  depth: number;
  onClose: () => void;
};

type SaveFileError = Error & { fieldErrors?: Record<string, string> };

const InlineEntryEditor = ({ entryPath, entryType, entryId, depth, onClose }: InlineEntryEditorProps) => {
  const config = useConfig();
  const { bumpRefresh } = useEntryStack();

  const entryQuery = useEntry(entryPath);
  const entry = entryQuery.data;
  const isLoading = entryQuery.isPending && !entry;

  const isProductionQuery = useIsProduction();
  const hasActiveBranchQuery = useHasActiveBranch();
  const isProduction = isProductionQuery.data ?? false;
  const activeBranchSet = hasActiveBranchQuery.data ?? true;

  const saveMutation = useSaveFile();
  const removeMutation = useRemoveFile();
  const publishMutation = usePublishEntry();
  const archiveMutation = useArchiveEntry();
  const restoreMutation = useRestoreEntry();
  const isSaving =
    saveMutation.isPending || publishMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [pendingSaveArgs, setPendingSaveArgs] = useState<{ sys: any; fields: any } | null>(null);
  // True once any save/delete inside this overlay has succeeded; consumed on close to bump refreshTick.
  const dirtyRef = useRef(false);

  const collectionLabel = config.collections[entryType as keyof Config['collections']]?.label || entryType;

  // Backlinks query — disabled until the delete dialog opens.
  const referenceKey = toReferenceKey(entryPath);
  const backlinksQuery = useEntryBacklinks(referenceKey, { enabled: isDeleteOpen });
  const deleteBacklinks = backlinksQuery.data ?? [];
  const isLoadingBacklinks = backlinksQuery.isPending && isDeleteOpen;

  // If the overlay unmounts while dirty (e.g. browser back, parent closeAll),
  // notify subscribers. The Back button calls handleClose directly and resets the flag.
  useEffect(() => {
    return () => {
      if (dirtyRef.current) {
        bumpRefresh();
        dirtyRef.current = false;
      }
    };
  }, [bumpRefresh]);

  const clearFieldError = useCallback((name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const handleClose = useCallback(() => {
    if (dirtyRef.current) {
      // Notify subscribers (parent FormReferenceField, LinkedBySection, HistorySection)
      // that entries beneath them changed while this overlay was open.
      bumpRefresh();
      dirtyRef.current = false;
    }
    onClose();
  }, [bumpRefresh, onClose]);

  const executeSave = useCallback(
    async (sys: any, fields: any) => {
      try {
        await saveMutation.mutateAsync({ fileName: entryPath, data: { sys, fields } });
        toast({ title: 'Saved successfully', variant: 'success' });
        dirtyRef.current = true;
        // Cache invalidation triggers refetch automatically; no need for manual setEntry.
      } catch (e) {
        const err = e as SaveFileError;
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        toast({ title: err.message, variant: 'destructive' });
      }
    },
    [entryPath, saveMutation],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!entryType) return;

    const formData = new FormData(e.currentTarget);
    const fields: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v === 'string') fields[k] = v;
    }

    const validation = validateEntryFields(entryType, fields);
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
      return;
    }

    setFieldErrors({});
    const sys = { ...entry?.sys, type: entryType };

    if (isProduction && !activeBranchSet) {
      setPendingSaveArgs({ sys, fields });
      setCreateBranchOpen(true);
      return;
    }

    void executeSave(sys, fields);
  };

  const handleBranchCreated = (_branchName: string, _prUrl: string, _prWarning?: string) => {
    setCreateBranchOpen(false);
    // The branch mutation invalidates `git.hasActive`, so the gate updates automatically.
    if (pendingSaveArgs) {
      void executeSave(pendingSaveArgs.sys, pendingSaveArgs.fields);
      setPendingSaveArgs(null);
    }
  };

  const openDeleteDialog = () => {
    setIsDeleteOpen(true);
  };

  const handleDelete = async () => {
    setIsDeleteOpen(false);
    try {
      await removeMutation.mutateAsync(entryPath);
      toast({ title: 'Entry removed', variant: 'success' });
      dirtyRef.current = true;
      handleClose();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const currentStatus: EntryStatus = entry?.sys?.status || 'merged';

  const handlePublish = async () => {
    try {
      await publishMutation.mutateAsync(entryPath);
      toast({ title: 'Published successfully', variant: 'success' });
      dirtyRef.current = true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Publish failed', variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveMutation.mutateAsync(entryPath);
      toast({ title: 'Entry archived', variant: 'success' });
      dirtyRef.current = true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Archive failed', variant: 'destructive' });
    }
  };

  const handleRestore = async () => {
    try {
      await restoreMutation.mutateAsync(entryPath);
      toast({ title: 'Entry restored', variant: 'success' });
      dirtyRef.current = true;
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Restore failed', variant: 'destructive' });
    }
  };

  const selectedFile = { type: entryType, id: entryId, path: entryPath };

  const leftInsetPx = depth * 100;

  return (
    <div className="absolute inset-0" style={{ zIndex: 10 + depth }}>
      <div className="absolute inset-0 z-0 bg-black/30" aria-hidden />
      <div
        className="absolute z-10 top-0 right-0 bottom-0 flex min-w-0 flex-col bg-background shadow-lg animate-in slide-in-from-right-4 duration-200"
        style={{ left: leftInsetPx }}
      >
        {/* Top bar */}
        <div className="flex-none flex h-[var(--header-height)] items-center bg-background border-b border-border">
          <div className="flex-none px-5 py-2.5">
            <Button variant="ghost" size="sm" onClick={handleClose}>
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              {collectionLabel}
              {entry && <StatusBadge status={currentStatus} />}
            </div>
            <div className="truncate text-base font-semibold text-foreground">{entry?.fields?.title || entryId}</div>
          </div>
          <div className="flex-none px-5 py-2.5 flex items-center gap-2">
            {currentStatus === 'archived' ? (
              <>
                <Button variant="outline" size="sm" onClick={handleRestore} disabled={isSaving}>
                  Restore
                </Button>
                <Button variant="destructive" size="sm" onClick={openDeleteDialog} disabled={isSaving}>
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete permanently
                </Button>
              </>
            ) : (
              <Button variant="outline" size="sm" className="text-gray-500" onClick={handleArchive} disabled={isSaving}>
                Archive
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">Loading entry...</div>
        ) : !entry ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">Entry not found</div>
        ) : (
          <form
            className="flex min-h-0 flex-1 overflow-auto"
            onSubmit={handleSubmit}
            onInput={(e) => {
              const t = e.target;
              if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.name) {
                clearFieldError(t.name);
              }
            }}
            onChange={(e) => {
              const t = e.target;
              if ((t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) && t.name) {
                clearFieldError(t.name);
              }
            }}
          >
            <div className="flex-1 overflow-y-auto p-10 px-5">
              <div className="mx-auto max-w-[1000px]">
                <FormFields
                  key={`${entryPath}-${entryQuery.dataUpdatedAt}`}
                  selectedFile={selectedFile}
                  fields={entry.fields}
                  fieldErrors={fieldErrors}
                  onClearFieldError={clearFieldError}
                />
              </div>
            </div>
            <div className="relative w-[360px] flex-none overflow-y-auto border-l border-border bg-background">
              <div className="sticky left-0 top-0 w-full p-10 px-5">
                <div className="mb-4 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-sm">
                  <span className="font-medium text-muted-foreground">ID:</span>
                  <span className="text-foreground">{entryId}</span>
                  <span className="font-medium text-muted-foreground">Type:</span>
                  <span className="text-foreground">{collectionLabel}</span>
                  <span className="font-medium text-muted-foreground">Status:</span>
                  <span>
                    <StatusBadge status={currentStatus} />
                  </span>
                </div>
                <Button
                  type="submit"
                  className="mb-2 w-full"
                  disabled={isSaving || Object.keys(fieldErrors).length > 0}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                {(currentStatus === 'draft' || currentStatus === 'changed') && (
                  <Button
                    type="button"
                    className="mb-6 w-full bg-green-600 hover:bg-green-700"
                    onClick={handlePublish}
                    disabled={isSaving}
                  >
                    Publish
                  </Button>
                )}
                {currentStatus !== 'draft' && currentStatus !== 'changed' && <div className="mb-4" />}

                <LinkedBySection entryPath={entryPath} />
              </div>
            </div>
          </form>
        )}

        {/* Delete confirmation dialog with backlink warnings */}
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Permanent Deletion</DialogTitle>
              <DialogDescription>
                Are you sure you want to permanently delete this entry? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {isLoadingBacklinks ? (
              <div className="py-2 text-sm text-muted-foreground">Checking references...</div>
            ) : (
              deleteBacklinks.length > 0 && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <p className="mb-1 text-sm font-medium text-destructive">
                    This entry is referenced by {deleteBacklinks.length}{' '}
                    {deleteBacklinks.length === 1 ? 'entry' : 'entries'}:
                  </p>
                  <ul className="space-y-0.5 text-sm text-muted-foreground">
                    {deleteBacklinks.map((link) => (
                      <li key={link.path} className="truncate">
                        {link.title}{' '}
                        <span className="text-xs">
                          ({config.collections[link.type as keyof Config['collections']]?.label || link.type})
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-destructive">Removing it will break those references.</p>
                </div>
              )
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={isLoadingBacklinks}>
                Delete permanently
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <CreateBranchDialog
          open={createBranchOpen}
          onOpenChange={setCreateBranchOpen}
          onBranchCreated={handleBranchCreated}
        />
      </div>
    </div>
  );
};

export default InlineEntryEditor;
