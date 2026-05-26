'use client';

import { Icon } from '../ui/icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { useEntry } from '../../admin/query/hooks/useEntry';
import { useEntryBacklinks } from '../../admin/query/hooks/useEntryBacklinks';
import {
  useArchiveEntry,
  useRemoveFile,
  useRestoreEntry,
  useSaveFile,
} from '../../admin/query/hooks/useEntryMutations';
import { invalidateAfterMutationAsync } from '../../admin/query/invalidate';
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
  const router = useRouter();
  const qc = useQueryClient();

  const entryQuery = useEntry(entryPath);
  const entry = entryQuery.data;
  const isLoading = entryQuery.isPending && !entry;

  const isProductionQuery = useIsProduction();
  const hasActiveBranchQuery = useHasActiveBranch();
  const isProduction = isProductionQuery.data ?? false;
  const activeBranchSet = hasActiveBranchQuery.data ?? true;

  const saveMutation = useSaveFile();
  const removeMutation = useRemoveFile();
  const archiveMutation = useArchiveEntry();
  const restoreMutation = useRestoreEntry();
  const isSaving = saveMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;

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

  const handleBranchCreated = async (_branchName: string, _prUrl: string, _prWarning?: string) => {
    setCreateBranchOpen(false);
    await invalidateAfterMutationAsync(qc, ['git']);
    router.refresh();
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
    <div className="octo-inline-editor" style={{ zIndex: 45 + depth }}>
      <div className="octo-inline-editor__container" style={{ paddingLeft: leftInsetPx }}>
        <div className="octo-inline-editor__backdrop" style={{ width: leftInsetPx }}>
          <div className="octo-inline-editor__backdrop-top">
            <Button
              variant="secondary"
              onClick={handleClose}
              className="octo-inline-editor__backdrop-button"
              aria-label="Close editor"
            >
              <Icon.ArrowLeft className="octo-icon-md" />
            </Button>
          </div>
        </div>
        <div className="octo-inline-editor__panel">
          {/* Content */}
          {isLoading ? (
            <div className="octo-inline-editor__loading">Loading entry...</div>
          ) : !entry ? (
            <div className="octo-inline-editor__loading">Entry not found</div>
          ) : (
            <form
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
              <div className="octo-page-top octo-inline-editor__top">
                <div className="octo-page-top__title-area">
                  <div className="octo-page-top__breadcrumb">{collectionLabel}</div>
                  <div className="octo-page-top__title-row">
                    <h1 className="octo-page-top__title">{entry?.fields?.title || entryId}</h1>
                  </div>
                </div>
                <div className="octo-page-top__right">
                  {currentStatus === 'archived' ? (
                    <>
                      <Button variant="outline" onClick={handleRestore} disabled={isSaving}>
                        Restore
                      </Button>
                      <Button variant="destructive" onClick={openDeleteDialog} disabled={isSaving}>
                        <Icon.Trash2 className="octo-icon-md octo-u-mr-1" />
                        Delete permanently
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" onClick={handleArchive} disabled={isSaving}>
                      Archive
                    </Button>
                  )}
                  <Button type="submit" disabled={isSaving || Object.keys(fieldErrors).length > 0}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
              <div className="octo-inline-editor__body">
                <div className="octo-inline-editor__fields">
                  <div className="octo-inline-editor__fields-inner">
                    <FormFields
                      key={`${entryPath}-${entryQuery.dataUpdatedAt}`}
                      selectedFile={selectedFile}
                      fields={entry.fields}
                      fieldErrors={fieldErrors}
                      onClearFieldError={clearFieldError}
                    />
                  </div>
                </div>
                <div className="octo-inline-editor__sidebar">
                  <div className="octo-inline-editor__sidebar-inner">
                    <div className="octo-inline-editor__meta-grid">
                      <span className="octo-inline-editor__meta-key">ID:</span>
                      <span className="octo-inline-editor__meta-val">{entryId}</span>
                      <span className="octo-inline-editor__meta-key">Type:</span>
                      <span className="octo-inline-editor__meta-val">{collectionLabel}</span>
                      <span className="octo-inline-editor__meta-key">Status:</span>
                      <span>
                        <StatusBadge status={currentStatus} />
                      </span>
                    </div>
                    <LinkedBySection entryPath={entryPath} />
                  </div>
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
                <div className="octo-inline-editor__loading octo-u-py-2">Checking references...</div>
              ) : (
                deleteBacklinks.length > 0 && (
                  <div className="octo-inline-editor__delete-warning">
                    <p className="octo-inline-editor__delete-warning-title">
                      This entry is referenced by {deleteBacklinks.length}{' '}
                      {deleteBacklinks.length === 1 ? 'entry' : 'entries'}:
                    </p>
                    <ul className="octo-inline-editor__delete-warning-list">
                      {deleteBacklinks.map((link) => (
                        <li key={link.path} className="octo-inline-editor__delete-warning-item">
                          {link.title}{' '}
                          <span className="octo-u-text-sm">
                            ({config.collections[link.type as keyof Config['collections']]?.label || link.type})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="octo-inline-editor__delete-warning-foot">Removing it will break those references.</p>
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
    </div>
  );
};

export default InlineEntryEditor;
