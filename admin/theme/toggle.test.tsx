import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../components/ui', () => ({
  Switcher: ({ children, ...props }: React.PropsWithChildren<React.HTMLAttributes<HTMLDivElement>>) => (
    <div role="tablist" {...props}>
      {children}
    </div>
  ),
  SwitcherItem: ({
    children,
    active,
    onClick,
  }: React.PropsWithChildren<{ active?: boolean; onClick?: () => void }>) => (
    <button type="button" role="tab" aria-selected={active} onClick={onClick}>
      {children}
    </button>
  ),
}));

const { ThemeToggle } = await import('./toggle');

beforeEach(() => {
  document.getElementById('cms-layout')?.classList.remove('light');
  document.body.classList.remove('light');
});

afterEach(() => {
  cleanup();
});

describe('ThemeToggle', () => {
  it('renders Dark and Light options', () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.getByRole('tab', { name: 'Dark' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Light' })).toBeTruthy();
  });

  it('marks Dark active when initialTheme is dark', () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Light' }).getAttribute('aria-selected')).toBe('false');
  });

  it('marks Light active when initialTheme is light', () => {
    render(<ThemeToggle initialTheme="light" />);
    expect(screen.getByRole('tab', { name: 'Light' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('false');
  });

  it('does not render a "System" option', () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.queryByText(/system/i)).toBeNull();
  });

  it('switches to Light when Light is clicked', () => {
    render(<ThemeToggle initialTheme="dark" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Light' }));
    expect(screen.getByRole('tab', { name: 'Light' }).getAttribute('aria-selected')).toBe('true');
    expect(document.body.classList.contains('light')).toBe(true);
  });

  it('switches to Dark when Dark is clicked', () => {
    render(<ThemeToggle initialTheme="light" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Dark' }));
    expect(screen.getByRole('tab', { name: 'Dark' }).getAttribute('aria-selected')).toBe('true');
    expect(document.body.classList.contains('light')).toBe(false);
  });
});
