'use client';

import { ArrowLeft, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useRef, useState, useTransition } from 'react';

import {
  getEntryBacklinks,
  getFile,
  getIsProduction,
  hasActiveBranch,
  removeFile,
  saveFile,
  publishEntry,
  archiveEntry,
  restoreEntry,
} from '../../admin/actions';
import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import { useEntryStack } from '../../hooks/useEntryStack';
import { toast } from '../../hooks/useToast';
import { toReferenceKey } from '../../lib/referenceKeys';
import { validateEntryFields } from '../../lib/validateEntryFields';
import type { EntryListItem, EntryStatus } from '../../types';
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

const InlineEntryEditor = ({ entryPath, entryType, entryId, depth, onClose }: InlineEntryEditorProps) => {
  const config = useConfig();
  const router = useRouter();
  const { bumpRefresh } = useEntryStack();
  const [entry, setEntry] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deleteBacklinks, setDeleteBacklinks] = useState<EntryListItem[]>([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [isProduction, setIsProduction] = useState(false);
  const [activeBranchSet, setActiveBranchSet] = useState(true);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [pendingSaveArgs, setPendingSaveArgs] = useState<{ sys: any; fields: any } | null>(null);
  // True once any save/delete inside this overlay has succeeded; consumed on close to bump refreshTick.
  const dirtyRef = useRef(false);

  const collectionLabel = config.collections[entryType as keyof Config['collections']]?.label || entryType;

  // Load entry data on mount
  useEffect(() => {
    const load = async () => {
      try {
        const data = await getFile(entryPath);
        setEntry(data);
      } catch (_e) {
        toast({ title: `Failed to load entry: ${entryId}`, variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [entryPath, entryId]);

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

  // Check production/branch status
  useEffect(() => {
    getIsProduction().then((isProd) => {
      setIsProduction(isProd);
      if (isProd) {
        hasActiveBranch().then(setActiveBranchSet);
      }
    });

    const handler = () => {
      hasActiveBranch().then(setActiveBranchSet);
    };
    window.addEventListener('cms:branch-changed', handler);
    return () => window.removeEventListener('cms:branch-changed', handler);
  }, []);

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
    (sys: any, fields: any) => {
      startSaving(async () => {
        const result = await saveFile({ sys, fields }, entryPath);
        if (result.success) {
          toast({ title: 'Saved successfully', variant: 'success' });
          dirtyRef.current = true;
          // Re-run server components in case any data flow elsewhere depends on this entry.
          router.refresh();
          const updated = await getFile(entryPath);
          setEntry(updated);
        } else {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          toast({ title: result.error, variant: 'destructive' });
        }
      });
    },
    [entryPath, router],
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

    executeSave(sys, fields);
  };

  const handleBranchCreated = (_branchName: string, _prUrl: string, _prWarning?: string) => {
    setActiveBranchSet(true);
    setCreateBranchOpen(false);
    window.dispatchEvent(new Event('cms:branch-changed'));
    if (pendingSaveArgs) {
      executeSave(pendingSaveArgs.sys, pendingSaveArgs.fields);
      setPendingSaveArgs(null);
    }
  };

  const openDeleteDialog = async () => {
    setIsLoadingBacklinks(true);
    setIsDeleteOpen(true);
    try {
      const referenceKey = toReferenceKey(entryPath);
      const links = await getEntryBacklinks(referenceKey);
      setDeleteBacklinks(links);
    } catch (_e) {
      setDeleteBacklinks([]);
    } finally {
      setIsLoadingBacklinks(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleteOpen(false);
    const result = await removeFile(entryPath);
    if (result.success) {
      toast({ title: 'Entry removed', variant: 'success' });
      dirtyRef.current = true;
      router.refresh();
      handleClose();
    } else {
      toast({ title: result.error, variant: 'destructive' });
    }
  };

  const currentStatus: EntryStatus = entry?.sys?.status || 'merged';

  const handlePublish = () => {
    startSaving(async () => {
      const result = await publishEntry(entryPath);
      if (result.success) {
        toast({ title: 'Published successfully', variant: 'success' });
        dirtyRef.current = true;
        router.refresh();
        const updated = await getFile(entryPath);
        setEntry(updated);
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
  };

  const handleArchive = () => {
    startSaving(async () => {
      const result = await archiveEntry(entryPath);
      if (result.success) {
        toast({ title: 'Entry archived', variant: 'success' });
        dirtyRef.current = true;
        router.refresh();
        const updated = await getFile(entryPath);
        setEntry(updated);
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
  };

  const handleRestore = () => {
    startSaving(async () => {
      const result = await restoreEntry(entryPath);
      if (result.success) {
        toast({ title: 'Entry restored', variant: 'success' });
        dirtyRef.current = true;
        router.refresh();
        const updated = await getFile(entryPath);
        setEntry(updated);
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
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
