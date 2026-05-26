'use client';

import React from 'react';

import { useBranchList } from '../../admin/query/hooks/useBranchList';
import { useClearBranch, usePublishBranch, useSetActiveBranch } from '../../admin/query/hooks/useBranchMutations';
import { toast } from '../../hooks/useToast';
import { cn } from '../../lib/utils';
import { Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Icon } from '../ui';

type BranchSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeBranch: string;
  onRequestCreateBranch: () => void;
};

function isActiveBranch(branch: string, activeBranch: string, isBaseRow: boolean) {
  if (activeBranch) return branch === activeBranch;
  return isBaseRow;
}

export function BranchSelectorDialog({
  open,
  onOpenChange,
  activeBranch,
  onRequestCreateBranch,
}: BranchSelectorDialogProps) {
  const branchListQuery = useBranchList({ enabled: open });
  const setActiveBranchMutation = useSetActiveBranch();
  const clearBranchMutation = useClearBranch();
  const publishBranchMutation = usePublishBranch();

  const cmsBranches = branchListQuery.data ?? [];
  const branchListLoading = branchListQuery.isPending && branchListQuery.fetchStatus !== 'idle';

  const handleSwitchBranch = async (branch: string, isBaseRow: boolean) => {
    if (isBaseRow) {
      await clearBranchMutation.mutateAsync();
      toast({ title: `Viewing ${branch} (read-only)`, variant: 'success' });
      return;
    }
    await setActiveBranchMutation.mutateAsync(branch);
    toast({ title: `Switched to ${branch}`, variant: 'success' });
  };

  const handleClearBranch = async () => {
    await clearBranchMutation.mutateAsync();
    toast({ title: 'Back to main branch', variant: 'success' });
    onOpenChange(false);
  };

  const handlePublish = async (branchName: string) => {
    onOpenChange(false);
    try {
      await publishBranchMutation.mutateAsync(branchName);
      toast({ title: `Published: ${branchName}`, variant: 'success' });
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Publish failed', variant: 'destructive' });
    }
  };

  const handleCreateBranch = () => {
    onOpenChange(false);
    onRequestCreateBranch();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="octo-branch-selector-dialog">
        <DialogHeader>
          <DialogTitle>Branch</DialogTitle>
        </DialogHeader>

        <Button
          type="button"
          variant="outline"
          className="octo-branch-selector-dialog__create"
          icon={<Icon.Plus className="octo-icon-md" />}
          onClick={handleCreateBranch}
        >
          Create new branch
        </Button>

        {(branchListLoading || cmsBranches.length > 0) && (
          <div className="octo-branch-selector-dialog__list" role="list">
            {branchListLoading && (
              <div className="octo-branch-selector-dialog__loading">
                <Icon.RefreshCw className="octo-branch-selector-dialog__spinner" />
                Loading…
              </div>
            )}

            {!branchListLoading &&
              cmsBranches.map((b) => {
                const isBaseRow = b.prNumber === 0 && !b.prUrl;
                const selected = isActiveBranch(b.branch, activeBranch, isBaseRow);

                return (
                  <div key={b.branch} className="octo-branch-selector-dialog__row" role="listitem">
                    <Button
                      type="button"
                      variant={selected ? 'secondary' : 'ghost'}
                      className="octo-branch-selector-dialog__branch"
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => handleSwitchBranch(b.branch, isBaseRow)}
                    >
                      <span
                        className={cn(
                          'octo-branch-selector-dialog__dot',
                          selected && 'octo-branch-selector-dialog__dot--active',
                        )}
                        aria-hidden
                      />
                      <span className="octo-branch-selector-dialog__name">{b.branch}</span>
                    </Button>

                    {b.isPublished && <span className="octo-branch-selector-dialog__live">Live</span>}

                    {!b.isPublished && (
                      <Button
                        type="button"
                        variant="ghost"
                        className="octo-branch-selector-dialog__publish"
                        onClick={() => handlePublish(b.branch)}
                        title={`Publish ${b.branch}`}
                      >
                        Publish
                      </Button>
                    )}

                    {b.prUrl && (
                      <Button
                        asChild
                        variant="ghost"
                        size="icon"
                        className="octo-branch-selector-dialog__pr"
                        title="Open PR on GitHub"
                      >
                        <a href={b.prUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Icon.ExternalLink className="octo-icon-xs" />
                        </a>
                      </Button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        <DialogFooter className="octo-branch-selector-dialog__footer">
          <Button type="button" variant="ghost" icon={<Icon.X className="octo-icon-md" />} onClick={handleClearBranch}>
            Back to main
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
