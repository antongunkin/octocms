'use client';

import React, { useState } from 'react';
import { DropdownMenuItem, DropdownMenuSeparator, Icon } from '../../components/ui';
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
      <DropdownMenuItem className="octo-theme-toggle__item" onSelect={toggle}>
        {isLight ? <Icon.Moon className="octo-theme-toggle__icon" /> : <Icon.Sun className="octo-theme-toggle__icon" />}
        {isLight ? 'Dark mode' : 'Light mode'}
      </DropdownMenuItem>
    </>
  );
}
