'use client';

import { useRouter } from 'next/navigation';
import React, { Suspense, useCallback, useEffect, useState, useTransition } from 'react';

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
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui';
import { toast } from '../../hooks/useToast';
import CreateBranchDialog from '../CreateBranchDialog';

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

  if (!post?.fields) {
    return 'No selected post';
  }

  return (
    <div className="relative flex-1 w-full flex flex-col">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-background flex-none">
        <Button asChild variant="ghost" size="sm">
          <a href={`/cms/${post?.sys?.type}`}>Back</a>
        </Button>
        <div className="mr-auto">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-0.5">
            {config.collections[post?.sys?.type as keyof typeof config.collections]?.label ?? post?.sys?.type}
            <StatusBadge status={currentStatus} />
          </div>
          <h1 className="text-xl font-semibold text-foreground">
            {config.collections[post?.sys?.type as keyof typeof config.collections]?.label ?? post?.sys?.type}
          </h1>
        </div>
        <div className="flex items-center gap-2">
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
      <form
        className="flex flex-1 min-h-0 overflow-hidden"
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
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1000px] mx-auto">
            <FormFields
              selectedFile={selectedFile}
              fields={post?.fields}
              fieldErrors={fieldErrors}
              onClearFieldError={clearFieldError}
            />
          </div>
        </div>
        <div className="w-80 flex-none border-l border-border bg-background flex flex-col overflow-hidden">
          <div className="flex items-center px-4 py-3 border-b border-border flex-none">
            <h2 className="text-sm font-medium text-foreground">Entry details</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-14 flex-none text-xs">ID</span>
                <span className="text-foreground text-xs truncate">{post?.sys?.id}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-14 flex-none text-xs">Type</span>
                <span className="text-foreground text-xs">
                  {config.collections[post?.sys?.type as keyof typeof config.collections]?.label ?? post?.sys?.type}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-14 flex-none text-xs">Status</span>
                <StatusBadge status={currentStatus} />
              </div>
            </div>
            <div className="space-y-2">
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="w-full bg-blue-600 hover:bg-blue-500 text-white"
                disabled={isSaving || Object.keys(fieldErrors).length > 0}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              {(currentStatus === 'draft' || currentStatus === 'changed') && (
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="w-full bg-green-600 hover:bg-green-500 text-white"
                  onClick={handlePublish}
                  disabled={isSaving}
                >
                  Publish
                </Button>
              )}
            </div>
            {selectedFile && <LinkedBySection entryPath={selectedFile.path} />}
          </div>
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
