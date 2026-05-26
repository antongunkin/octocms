import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaViewModeSwitcher } from './MediaViewModeSwitcher';

afterEach(cleanup);

describe('MediaViewModeSwitcher', () => {
  it('renders grid and list tabs inside a switcher', () => {
    render(<MediaViewModeSwitcher value="grid" onChange={() => {}} />);
    expect(screen.getByRole('tablist', { name: 'View mode' }).className).toContain('octo-switcher');
    expect(screen.getByRole('tab', { name: 'Grid view' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'List view' }).getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange when list view is selected', () => {
    const onChange = vi.fn();
    render(<MediaViewModeSwitcher value="grid" onChange={onChange} />);
    fireEvent.click(screen.getByRole('tab', { name: 'List view' }));
    expect(onChange).toHaveBeenCalledWith('list');
  });

  it('marks list as active when value is list', () => {
    render(<MediaViewModeSwitcher value="list" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: 'List view' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Grid view' }).getAttribute('aria-selected')).toBe('false');
  });
});
