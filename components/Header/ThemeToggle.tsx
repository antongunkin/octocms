'use client';

import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

import { useTheme } from '../../admin/ThemeProvider';
import type { Theme } from '../../admin/theme';
import { DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator } from '../ui';

/**
 * Appearance radio group rendered inside the user avatar dropdown in the Header.
 * Displays Light / Dark / System options and persists the selection to the
 * `cms-theme` cookie via `useTheme().setTheme`.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="px-2 pt-1 text-xs font-normal text-muted-foreground">Appearance</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
        <DropdownMenuRadioItem value="light" className="cursor-pointer gap-2">
          <Sun className="h-3.5 w-3.5" />
          Light
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="dark" className="cursor-pointer gap-2">
          <Moon className="h-3.5 w-3.5" />
          Dark
        </DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="system" className="cursor-pointer gap-2">
          <Monitor className="h-3.5 w-3.5" />
          System
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </>
  );
}
