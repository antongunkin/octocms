'use client';

import React, { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

import { DropdownMenuItem, DropdownMenuSeparator } from '../../components/ui';
import type { Theme } from './types';

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      const el = document.getElementById('cms-layout');
      if (el) return el.classList.contains('light');
    }
    return initialTheme === 'light';
  });

  const toggle = () => {
    const next = !isLight;
    setIsLight(next);
    document.getElementById('cms-layout')?.classList.toggle('light', next);
    document.body.classList.toggle('light', next);
    if (next) {
      document.cookie = 'cms-theme=light;path=/;max-age=31536000;SameSite=Lax';
    } else {
      document.cookie = 'cms-theme=;path=/;max-age=0;SameSite=Lax';
    }
  };

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuItem className="cursor-pointer gap-2" onSelect={toggle}>
        {isLight ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
        {isLight ? 'Dark mode' : 'Light mode'}
      </DropdownMenuItem>
    </>
  );
}
