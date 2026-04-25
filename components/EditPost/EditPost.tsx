'use client';

import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import React, { Suspense, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import {
  saveFile,
  removeFile,
  getIsProduction,
  hasActiveBranch,
  publishEntry,
  archiveEntry,
  restoreEntry,
} from '../../admin/actions';
import type { EntryStatus } from '../../types';
import { StatusBadge } from '../StatusBadge';
import { useFileState } from '../../hooks/useFileState';
import { EntryStackProvider, useEntryStack } from '../../hooks/useEntryStack';
import { validateEntryFields } from '../../lib/validateEntryFields';
import { rebuildConditionalFields } from '../../lib/conditionalField';
import type { Config } from '../../admin/types';
import { useConfig } from '../../hooks/useConfig';
import FormFields from '../FormFields';
import InlineEntryEditor from '../InlineEntryEditor/InlineEntryEditor';
import LinkedBySection from '../LinkedBySection/LinkedBySection';
import { DiffView } from '../DiffView';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui';
import { toast } from '../../hooks/useToast';
import CreateBranchDialog from '../CreateBranchDialog';

const HistorySection = dynamic(() => import('../HistorySection/HistorySection'), {
  ssr: false,
  loading: () => null,
});

const EditPostInner = ({ post }: { post: any }) => {
  const config = useConfig();
  const { selectedType, selectedFile, onFileClick } = useFileState();
  const { stack, popEntry } = useEntryStack();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSaving, startSaving] = useTransition();
  const [isProduction, setIsProduction] = useState(false);
  const [activeBranchSet, setActiveBranchSet] = useState(true);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [pendingSaveArgs, setPendingSaveArgs] = useState<{ sys: any; fields: any } | null>(null);
  const [viewMode, setViewMode] = useState<'edit' | 'diff'>('edit');

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

  const executeSave = useCallback(
    (sys: any, fields: any) => {
      if (!selectedFile?.path) return;
      startSaving(async () => {
        const result = await saveFile({ sys, fields }, selectedFile.path);
        if (result.success) {
          toast({ title: 'Saved successfully', variant: 'success' });
          router.refresh();
        } else {
          if (result.fieldErrors) {
            setFieldErrors(result.fieldErrors);
          }
          toast({ title: result.error, variant: 'destructive' });
        }
      });
    },
    [selectedFile, router],
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedFile?.path || !selectedType) return;

    const formData = new FormData(e.currentTarget);
    const fields: Record<string, string> = {};
    for (const [k, v] of formData.entries()) {
      if (typeof v === 'string') fields[k] = v;
    }

    // Rebuild conditional fields from dot-path FormData entries into nested JSON
    const collectionFields = config.collections[selectedType as keyof Config['collections']]?.fields;
    if (collectionFields) {
      rebuildConditionalFields(collectionFields, fields);
    }

    const validation = validateEntryFields(selectedType, fields);
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      toast({ title: 'Please fix the highlighted fields', variant: 'destructive' });
      return;
    }

    setFieldErrors({});
    const sys = { ...post.sys, type: selectedType };

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

  const onRemove = async (fileName: string | undefined) => {
    if (fileName) {
      const result = await removeFile(fileName);

      if (!result.success) {
        toast({ title: result.error, variant: 'destructive' });
        return;
      }

      onFileClick(undefined);
      router.push(`/cms/${post?.sys?.type}`);
    }
  };

  const currentStatus: EntryStatus = post?.sys?.status || 'merged';

  const handlePublish = () => {
    if (!selectedFile?.path) return;
    startSaving(async () => {
      const result = await publishEntry(selectedFile.path);
      if (result.success) {
        toast({ title: 'Published successfully', variant: 'success' });
        router.refresh();
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
  };

  const handleArchive = () => {
    if (!selectedFile?.path) return;
    startSaving(async () => {
      const result = await archiveEntry(selectedFile.path);
      if (result.success) {
        toast({ title: 'Entry archived', variant: 'success' });
        router.refresh();
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
  };

  const handleRestore = () => {
    if (!selectedFile?.path) return;
    startSaving(async () => {
      const result = await restoreEntry(selectedFile.path);
      if (result.success) {
        toast({ title: 'Entry restored', variant: 'success' });
        router.refresh();
      } else {
        toast({ title: result.error, variant: 'destructive' });
      }
    });
  };

  const collectionLabel = useMemo(() => {
    return config.collections[post?.sys?.type as keyof typeof config.collections]?.label ?? post?.sys?.type ?? '';
  }, [config, post?.sys?.type]);

  const fieldCount = useMemo(() => {
    const fields = config.collections[post?.sys?.type as keyof Config['collections']]?.fields;
    return fields ? Object.keys(fields).length : 0;
  }, [config, post?.sys?.type]);

  const entryTitle = useMemo(() => {
    const fields = config.collections[post?.sys?.type as keyof Config['collections']]?.fields;
    if (!fields || !post?.fields) return '';
    const titleKey = Object.keys(fields).find((k) => fields[k]?.entryTitle);
    if (titleKey && typeof post.fields[titleKey] === 'string') {
      return post.fields[titleKey] as string;
    }
    return '';
  }, [config, post?.sys?.type, post?.fields]);

  // The Edit/Diff toggle is only useful when there's an unmerged delta to compare:
  // - In production: a feature branch must be active (cookie set).
  // - In dev: always allow — the local `git` can always compare the working tree to base.
  // Archived entries hide the toggle (no editing workflow there).
  const diffToggleVisible = currentStatus !== 'archived' && (isProduction ? activeBranchSet : true);

  // If we lose visibility while in Diff mode (e.g. branch cleared), fall back to Edit.
  useEffect(() => {
    if (!diffToggleVisible && viewMode === 'diff') {
      setViewMode('edit');
    }
  }, [diffToggleVisible, viewMode]);

  if (!post?.fields) {
    return 'No selected post';
  }

  return (
    <div className="relative flex-1 w-full flex flex-col bg-background">
      {/* Subheader: back + breadcrumb + title + actions */}
      <div className="flex-none border-b border-border bg-background">
        <div className="max-w-[1320px] mx-auto w-full flex items-start gap-4 px-8 py-5">
          <Button asChild variant="outline" size="sm" className="gap-1.5 mt-0.5">
            <a href={`/cms/${post?.sys?.type}`}>
              <ChevronLeft className="h-4 w-4" />
              Back
            </a>
          </Button>
          <div className="flex flex-col gap-1.5 min-w-0 flex-[0_1_auto]">
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              <span>Content</span>
              <ChevronRight className="h-3 w-3" />
              <span>{collectionLabel}</span>
              {entryTitle && (
                <>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">{entryTitle}</span>
                </>
              )}
              <StatusBadge status={currentStatus} className="ml-1" />
            </div>
            <h1 className="text-[26px] font-semibold tracking-[-0.015em] leading-[1.2] text-foreground">
              {entryTitle || collectionLabel}
            </h1>
          </div>
          <div className="flex-1" />
          {diffToggleVisible && (
            <div
              role="tablist"
              aria-label="Edit or Diff view"
              className="inline-flex mt-0.5 rounded-md border border-border bg-muted/40 p-0.5"
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
          <div className="flex items-center gap-2 mt-0.5">
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
          </div>
        </div>
      </div>

      <form
        className="flex-1 min-h-0 overflow-y-auto"
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
        <div className="max-w-[1320px] mx-auto w-full px-8 py-7 pb-32 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-8">
          {/* Form / Diff column */}
          {viewMode === 'diff' && selectedFile ? (
            <div className="min-w-0">
              <DiffView collectionType={selectedType as string} entryPath={selectedFile.path} />
            </div>
          ) : (
            <section className="rounded-lg border border-border bg-card overflow-hidden">
              <header className="flex items-center gap-2.5 px-5 py-4 border-b border-border bg-muted/40">
                <h2 className="text-[15px] font-semibold text-foreground">{collectionLabel}</h2>
                <span className="text-[13px] text-muted-foreground">· {fieldCount} fields</span>
              </header>
              <div className="px-5 py-6">
                <FormFields
                  selectedFile={selectedFile}
                  fields={post?.fields}
                  fieldErrors={fieldErrors}
                  onClearFieldError={clearFieldError}
                />
              </div>
            </section>
          )}

          {/* Sidebar column */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-4 lg:self-start">
            <Card>
              <CardContent>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className="w-full"
                  disabled={isSaving || Object.keys(fieldErrors).length > 0}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </Button>
                {(currentStatus === 'draft' || currentStatus === 'changed') && (
                  <Button
                    type="button"
                    variant="default"
                    size="sm"
                    className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white"
                    onClick={handlePublish}
                    disabled={isSaving}
                  >
                    Publish
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Entry details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-[64px_1fr] gap-y-2.5 gap-x-3 text-[13px]">
                  <div className="text-muted-foreground">ID</div>
                  <div className="text-foreground font-mono text-xs truncate" title={post?.sys?.id}>
                    {post?.sys?.id}
                  </div>
                  <div className="text-muted-foreground">Type</div>
                  <div className="text-foreground">{collectionLabel}</div>
                  <div className="text-muted-foreground">Status</div>
                  <div>
                    <StatusBadge status={currentStatus} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {selectedFile && <HistorySection entryPath={selectedFile.path} />}

            {selectedFile && <LinkedBySection entryPath={selectedFile.path} />}
          </aside>
        </div>
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
                await onRemove(selectedFile?.path);
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

const EditPost = ({ post }: { post: any }) => {
  const rootEntry = {
    id: post?.sys?.id || '',
    type: post?.sys?.type || '',
    path: '',
    title: '',
  };

  return (
    <Suspense fallback={null}>
      <EntryStackProvider rootEntry={rootEntry}>
        <EditPostInner post={post} />
      </EntryStackProvider>
    </Suspense>
  );
};

export default EditPost;
