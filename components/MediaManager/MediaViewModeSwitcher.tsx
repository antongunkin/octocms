'use client';

import { Icon, Switcher, SwitcherItem } from '../ui';

type ViewMode = 'grid' | 'list';

type MediaViewModeSwitcherProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export function MediaViewModeSwitcher({ value, onChange }: MediaViewModeSwitcherProps) {
  return (
    <Switcher aria-label="View mode">
      <SwitcherItem key="grid" icon active={value === 'grid'} aria-label="Grid view" onClick={() => onChange('grid')}>
        <Icon.LayoutGrid className="octo-icon-sm" />
      </SwitcherItem>
      <SwitcherItem key="list" icon active={value === 'list'} aria-label="List view" onClick={() => onChange('list')}>
        <Icon.List className="octo-icon-sm" />
      </SwitcherItem>
    </Switcher>
  );
}
