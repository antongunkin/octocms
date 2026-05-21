'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ChevronRight } from 'lucide-react';

import { useEntry } from '../../admin/query/hooks/useEntry';
import { useEntryList } from '../../admin/query/hooks/useEntryList';
import { useHasActiveBranch } from '../../admin/query/hooks/useHasActiveBranch';
import { useIsProduction } from '../../admin/query/hooks/useIsProduction';
import {
  useArchiveEntry,
  useRemoveFile,
  useRestoreEntry,
  useSaveFile,
} from '../../admin/query/hooks/useEntryMutations';
import type { EntryStatus, SelectedFile } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { useFileState } from '../../hooks/useFileState';
import { EntryStackProvider, useEntryStack } from '../../hooks/useEntryStack';
import { validateEntryFields } from '../../lib/validateEntryFields';
import { rebuildConditionalFields } from '../../lib/conditionalField';
import type { Config } from '../../admin/types';
import { invalidateAfterMutationAsync } from '../../admin/query/invalidate';
import { useConfig } from '../../hooks/useConfig';
import FormFields from '../FormFields';
import InlineEntryEditor from '../InlineEntryEditor/InlineEntryEditor';
import LinkedBySection from '../LinkedBySection/LinkedBySection';
import { DiffView } from '../DiffView';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui';
import { toast } from '../../hooks/useToast';
import CreateBranchDialog from '../CreateBranchDialog';

import { EntryFormSkeleton } from './skeletons/EntryFormSkeleton';
import { EntrySidebarSkeleton } from './skeletons/EntrySidebarSkeleton';

const HistorySection = dynamic(() => import('../HistorySection/HistorySection'), {
  ssr: false,
  loading: () => null,
});

type EditPostProps = {
  type: string;
  id: string;
};

type SaveFileError = Error & { fieldErrors?: Record<string, string> };

const EditPostInner = ({ type, id }: EditPostProps) => {
  const config = useConfig();
  const { onFileClick } = useFileState();
  const { stack, popEntry } = useEntryStack();
  const router = useRouter();
  const qc = useQueryClient();

  const isProductionQuery = useIsProduction();
  const hasActiveBranchQuery = useHasActiveBranch();
  const isProduction = isProductionQuery.data ?? false;
  const activeBranchSet = hasActiveBranchQuery.data ?? true;

  // Resolve the entry's file path from `type + id` via the entries list.
  // The list cache is populated by /cms/content navigation; on a direct
  // visit this fetches once.
  const entryListQuery = useEntryList(type);
  const resolvedEntryItem = entryListQuery.data?.find((e) => e.id === id);
  const filePath = resolvedEntryItem?.path;

  const entryQuery = useEntry(filePath);
  const post = entryQuery.data;

  const selectedFile: SelectedFile | undefined = filePath ? { type, id, path: filePath } : undefined;

  // Sync the selectedFile into the FileContextProvider so other consumers
  // (overlays, inline editors) see it. The context starts undefined and
  // updates once the entry list resolves.
  useEffect(() => {
    onFileClick(selectedFile);
    // Intentionally narrow deps so we don't loop on every onFileClick identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, type, id]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [pendingSaveArgs, setPendingSaveArgs] = useState<{ sys: any; fields: any } | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');

  const saveMutation = useSaveFile();
  const removeMutation = useRemoveFile();
  const archiveMutation = useArchiveEntry();
  const restoreMutation = useRestoreEntry();
  const isSaving = saveMutation.isPending || archiveMutation.isPending || restoreMutation.isPending;

  const clearFieldError = useCallback((name: string) => {
    setFieldErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const executeSave = useCallback(
    async (sys: any, fields: any) => {
      if (!filePath) return;
      try {
        await saveMutation.mutateAsync({ fileName: filePath, data: { sys, fields } });
        toast({ title: 'Saved successfully', variant: 'success' });
      } catch (e) {
        const err = e as SaveFileError;
        if (err.fieldErrors) setFieldErrors(err.fieldErrors);
        toast({ title: err.message, variant: 'destructive' });
      }
    },
    [filePath, saveMutation],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!filePath || !post) return;

    const formData = new FormData(e.currentTarget);
    const fields: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v === 'string') fields[k] = v;
    }

    // Rebuild conditional fields from dot-path FormData entries into nested JSON
    const collectionFields = config.collections[type as keyof Config['collections']]?.fields;
    if (collectionFields) {
      rebuildConditionalFields(collectionFields, fields);
    }

    const validation = validateEntryFields(type, fields);
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
      return;
    }

    setFieldErrors({});
    const sys = { ...post.sys, type };

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

  const onRemove = async () => {
    if (!filePath) return;
    try {
      await removeMutation.mutateAsync(filePath);
      onFileClick(undefined);
      router.push(`/cms/content/${type}`);
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Delete failed', variant: 'destructive' });
    }
  };

  const currentStatus: EntryStatus = post?.sys?.status || 'merged';

  const handleArchive = async () => {
    if (!filePath) return;
    try {
      await archiveMutation.mutateAsync(filePath);
      toast({ title: 'Entry archived', variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Archive failed', variant: 'destructive' });
    }
  };

  const handleRestore = async () => {
    if (!filePath) return;
    try {
      await restoreMutation.mutateAsync(filePath);
      toast({ title: 'Entry restored', variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Restore failed', variant: 'destructive' });
    }
  };

  const collectionLabel = useMemo(
    () => config.collections[type as keyof typeof config.collections]?.label ?? type,
    [config, type],
  );

  const entryTitle = useMemo(() => {
    const fields = config.collections[type as keyof Config['collections']]?.fields;
    if (!fields || !post?.fields) return '';
    const titleKey = Object.keys(fields).find((k) => fields[k]?.entryTitle);
    if (titleKey && typeof post.fields[titleKey] === 'string') {
      return post.fields[titleKey] as string;
    }
    return '';
  }, [config, type, post?.fields]);

  // The Edit/Diff toggle is only useful when there's an unmerged delta to compare.
  const diffToggleVisible = currentStatus !== 'archived' && (isProduction ? activeBranchSet : true);

  useEffect(() => {
    if (!diffToggleVisible && viewMode === 'diff') {
      setViewMode('edit');
    }
  }, [diffToggleVisible, viewMode]);

  const isLoadingEntry =
    (entryListQuery.isPending && !entryListQuery.data) ||
    (entryQuery.isPending && !entryQuery.data && Boolean(filePath));
  const entryListResolved = !entryListQuery.isPending || Boolean(entryListQuery.data);
  const isNotFound = entryListResolved && !resolvedEntryItem;

  // Header chrome that's safe to render before the entry resolves.
  const headerChrome = (
    <div className="octo-page-chrome">
      <div className="octo-page-chrome__title-area">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Button asChild variant="ghost" size="icon" className="-ml-2 h-7 w-7 shrink-0 text-muted-foreground">
            <Link href={`/cms/content/${type}`} aria-label="Back to collection">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="octo-page-chrome__title-area">
            <div className="octo-page-chrome__breadcrumb">
              <Link href="/cms/content" style={{ color: 'var(--text-2)' }}>
                Content
              </Link>
              <ChevronRight className="h-3 w-3" style={{ opacity: 0.6 }} />
              <span>{collectionLabel}</span>
            </div>
            <div className="octo-page-chrome__title-row">
              <h1 className="octo-page-chrome__title">{entryTitle || collectionLabel}</h1>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (isLoadingEntry) {
    return (
      <div className="octo-edit-post">
        {headerChrome}
        <div className="octo-edit-post__body">
          <div className="octo-edit-post__form-col">
            <div className="octo-edit-post__form-wrap">
              <EntryFormSkeleton />
            </div>
          </div>
          <EntrySidebarSkeleton />
        </div>
      </div>
    );
  }

  if (isNotFound || !post?.fields) {
    return (
      <div className="octo-edit-post">
        {headerChrome}
        <div className="octo-edit-post__not-found">
          <p style={{ fontSize: '14px', fontWeight: 500 }}>Entry not found.</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/cms/content/${type}`}>Back to {collectionLabel}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page header — same chrome as MediaAsset / DashboardContent */}
      <div className="flex min-h-[52px] items-center justify-between gap-3 border-b border-border bg-[var(--bg)] px-6 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="-ml-2 h-7 w-7 shrink-0 text-muted-foreground">
            <Link href={`/cms/content/${type}`} aria-label="Back to collection">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0 flex-1">
            <div className="mb-px flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--text-2)' }}>
              <Link
                href="/cms/content"
                className="hover:text-foreground transition-colors"
                style={{ color: 'var(--text-2)' }}
              >
                Content
              </Link>
              <ChevronRight className="h-3 w-3 opacity-60" />
              <span>{collectionLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-ellipsis whitespace-nowrap text-[16px] font-semibold tracking-[-0.012em] text-foreground">
                {entryTitle || collectionLabel}
              </h1>
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          {diffToggleVisible && (
            <div
              role="tablist"
              aria-label="Edit or Diff view"
              className="inline-flex rounded-md border border-border bg-muted/40 p-0.5"
            >
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'edit'}
                onClick={() => setViewMode('edit')}
                className={cn(
                  'px-3 py-1 text-[13px] font-medium rounded transition-colors',
                  viewMode === 'edit'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Edit
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={viewMode === 'diff'}
                onClick={() => setViewMode('diff')}
                className={cn(
                  'px-3 py-1 text-[13px] font-medium rounded transition-colors',
                  viewMode === 'diff'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Diff
              </button>
            </div>
          )}
          {currentStatus === 'archived' ? (
            <>
              <Button variant="outline" size="sm" onClick={handleRestore} disabled={isSaving}>
                Restore
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setIsDialogOpen(true)} disabled={isSaving}>
                Delete permanently
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={isSaving}>
              Archive
            </Button>
          )}
          <Button
            type="submit"
            form="entry-form"
            variant="default"
            size="sm"
            disabled={isSaving || Object.keys(fieldErrors).length > 0}
          >
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      <form
        id="entry-form"
        className="flex-1 min-h-0 overflow-hidden flex"
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
        {/* Main content column — independently scrollable */}
        <div className="flex-1 min-w-0 overflow-y-auto bg-bg">
          <div className="max-w-[960px] mx-auto px-6 py-6 pb-32">
            {viewMode === 'diff' && selectedFile ? (
              <DiffView collectionType={type} entryPath={selectedFile.path} />
            ) : (
              <section className="rounded-2xl border border-border bg-bg px-7 py-7 shadow-1">
                <FormFields
                  key={`${filePath ?? ''}-${entryQuery.dataUpdatedAt}`}
                  selectedFile={selectedFile}
                  fields={post.fields}
                  fieldErrors={fieldErrors}
                  onClearFieldError={clearFieldError}
                />
              </section>
            )}
          </div>
        </div>

        {/* Sidebar — fixed width, independently scrollable, surface-2 panel */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-l border-border bg-surface-2 px-4 py-5 flex flex-col gap-5">
          {/* Entry details */}
          <div>
            <div className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Entry details
            </div>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-3 text-[12px]">
                <span className="w-16 shrink-0 text-muted-foreground">ID</span>
                <span className="flex-1 min-w-0 font-mono text-[11px] text-foreground truncate" title={post.sys?.id}>
                  {post.sys?.id}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="w-16 shrink-0 text-muted-foreground">Type</span>
                <span className="flex-1 text-foreground">{collectionLabel}</span>
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="w-16 shrink-0 text-muted-foreground">Status</span>
                <StatusBadge status={currentStatus} />
              </div>
            </div>
          </div>

          {selectedFile && <HistorySection entryPath={selectedFile.path} flat />}

          {selectedFile && <LinkedBySection entryPath={selectedFile.path} />}
        </aside>
      </form>

      {/* Inline entry editor overlays (rendered outside the form to avoid nested forms) */}
      {stack.slice(1).map((entry, i) => (
        <InlineEntryEditor
          key={entry.id}
          entryPath={entry.path}
          entryType={entry.type}
          entryId={entry.id}
          depth={i + 1}
          onClose={popEntry}
        />
      ))}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Permanent Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete this entry? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                setIsDialogOpen(false);
                await onRemove();
              }}
            >
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
  );
};

const EditPost = ({ type, id }: EditPostProps) => {
  const rootEntry = {
    id,
    type,
    path: '',
    title: '',
  };

  return (
    <EntryStackProvider rootEntry={rootEntry}>
      <EditPostInner type={type} id={id} />
    </EntryStackProvider>
  );
};

export default EditPost;
