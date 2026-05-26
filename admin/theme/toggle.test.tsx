import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../components/ui', () => ({
  Icon: {
    Sun: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-sun" {...props} />,
    Moon: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-moon" {...props} />,
  },
  DropdownMenuItem: ({
    children,
    onSelect,
    className,
  }: React.PropsWithChildren<{ onSelect?: () => void; className?: string }>) => (
    <button className={className} onClick={onSelect} type="button">
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
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
  it('renders "Light mode" when initialTheme is dark', () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.getByText('Light mode')).toBeTruthy();
  });

  it('renders "Dark mode" when initialTheme is light', () => {
    render(<ThemeToggle initialTheme="light" />);
    expect(screen.getByText('Dark mode')).toBeTruthy();
  });

  it('does not render a "System" option', () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.queryByText(/system/i)).toBeNull();
  });

  it('switches to "Dark mode" label after clicking "Light mode"', () => {
    render(<ThemeToggle initialTheme="dark" />);
    fireEvent.click(screen.getByText('Light mode'));
    expect(screen.getByText('Dark mode')).toBeTruthy();
  });

  it('switches to "Light mode" label after clicking "Dark mode"', () => {
    render(<ThemeToggle initialTheme="light" />);
    fireEvent.click(screen.getByText('Dark mode'));
    expect(screen.getByText('Light mode')).toBeTruthy();
  });
});
