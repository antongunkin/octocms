'use client';

import React, { useState } from 'react';
import { Switcher, SwitcherItem } from '../../components/ui';
import type { Theme } from './types';

function readCurrentTheme(initialTheme: Theme): Theme {
  if (typeof document !== 'undefined') {
    const el = document.getElementById('cms-layout');
    if (el) return el.classList.contains('light') ? 'light' : 'dark';
  }
  return initialTheme;
}

function applyTheme(next: Theme) {
  const isLight = next === 'light';
  document.getElementById('cms-layout')?.classList.toggle('light', isLight);
  document.body.classList.toggle('light', isLight);
  if (isLight) {
    document.cookie = 'cms-theme=light;path=/;max-age=31536000;SameSite=Lax';
  } else {
    document.cookie = 'cms-theme=;path=/;max-age=0;SameSite=Lax';
  }
}

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setThemeState] = useState<Theme>(() => readCurrentTheme(initialTheme));

  const setTheme = (next: Theme) => {
    setThemeState(next);
    applyTheme(next);
  };

  return (
    <Switcher aria-label="Theme">
      <SwitcherItem active={theme === 'dark'} onClick={() => setTheme('dark')}>
        Dark
      </SwitcherItem>
      <SwitcherItem active={theme === 'light'} onClick={() => setTheme('light')}>
        Light
      </SwitcherItem>
    </Switcher>
  );
}
