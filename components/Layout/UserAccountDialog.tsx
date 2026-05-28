'use client';

import React from 'react';

import type { Theme } from '../../admin/theme';
import { ThemeToggle } from '../../admin/theme';
import { useCmsSession } from '../../hooks/useCmsSession';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui';

type UserAccountDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userName?: string | null;
  userImage?: string | null;
  userInitials: string;
  initialTheme: Theme;
};

export function UserAccountDialog({
  open,
  onOpenChange,
  userName,
  userImage,
  userInitials,
  initialTheme,
}: UserAccountDialogProps) {
  const { signOut } = useCmsSession();

  const handleSignOut = () => {
    onOpenChange(false);
    void signOut();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="octo-sr-only">Account</DialogTitle>
        </DialogHeader>

        <div className="octo-user-account-dialog__profile">
          <Avatar className="octo-user-account-dialog__avatar">
            {userImage && <AvatarImage src={userImage} alt={userInitials} />}
            <AvatarFallback>{userInitials}</AvatarFallback>
          </Avatar>
          {userName && <p className="octo-user-account-dialog__name">{userName}</p>}
        </div>

        <div className="octo-user-account-dialog__theme">
          <span className="octo-label">Theme</span>
          <ThemeToggle initialTheme={initialTheme} />
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleSignOut}>
            Sign out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
