'use client';

import React, { useEffect, useState } from 'react';

import { createBranch } from '../admin/actions';
import { toast } from '../hooks/useToast';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBranchCreated: (branchName: string, prUrl: string, prWarning?: string) => void;
};

const todayString = () => new Date().toISOString().split('T')[0];

const CreateBranchDialog = ({ open, onOpenChange, onBranchCreated }: Props) => {
  const [branchName, setBranchName] = useState(`cms/edit-${todayString()}`);
  const [workspaceTitle, setWorkspaceTitle] = useState(`CMS content update (${todayString()})`);
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const day = todayString();
    setBranchName(`cms/edit-${day}`);
    setWorkspaceTitle(`CMS content update (${day})`);
    setDescription('');
  }, [open]);

  const handleCreate = async () => {
    const trimmedBranch = branchName.trim();
    const trimmedTitle = workspaceTitle.trim();
    if (!trimmedBranch || !trimmedTitle) {
      return;
    }

    setIsCreating(true);
    const result = await createBranch({
      branchName: trimmedBranch,
      title: trimmedTitle,
      ...(description.trim() ? { description: description.trim() } : {}),
    });
    setIsCreating(false);

    if (result.success) {
      onBranchCreated(trimmedBranch, result.prUrl, result.prWarning);
      onOpenChange(false);
    } else {
      toast({
        title: "Couldn't create branch",
        description: result.error,
        variant: 'destructive',
      });
    }
  };

  const handleTextFieldEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a working branch</DialogTitle>
          <DialogDescription>
            Changes will be committed to this branch instead of the base branch. A draft pull request is opened when
            possible after saving branch metadata to the repo.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-3">
          <div>
            <label htmlFor="branch-name-input" className="text-sm font-medium text-gray-700 block mb-1.5">
              Branch name
            </label>
            <input
              id="branch-name-input"
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              onKeyDown={handleTextFieldEnter}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
            />
          </div>
          <div>
            <label htmlFor="workspace-title-input" className="text-sm font-medium text-gray-700 block mb-1.5">
              Workspace title
            </label>
            <input
              id="workspace-title-input"
              type="text"
              value={workspaceTitle}
              onChange={(e) => setWorkspaceTitle(e.target.value)}
              onKeyDown={handleTextFieldEnter}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isCreating}
              placeholder="Used as the draft pull request title"
            />
          </div>
          <div>
            <label htmlFor="workspace-description-input" className="text-sm font-medium text-gray-700 block mb-1.5">
              Description <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <textarea
              id="workspace-description-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y min-h-[4.5rem]"
              disabled={isCreating}
              placeholder="Shown in the pull request body"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !branchName.trim() || !workspaceTitle.trim()}>
            {isCreating ? 'Creating…' : 'Create branch'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreateBranchDialog;
