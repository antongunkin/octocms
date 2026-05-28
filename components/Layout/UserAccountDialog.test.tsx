import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const signOutMock = vi.fn();

vi.mock('../../hooks/useCmsSession', () => ({
  useCmsSession: () => ({
    data: { user: { id: '1', name: 'Jane Doe' } },
    status: 'authenticated',
    signIn: vi.fn(),
    signOut: (...args: unknown[]) => signOutMock(...args),
  }),
}));

vi.mock('../../admin/theme', () => ({
  ThemeToggle: ({ initialTheme }: { initialTheme: string }) => (
    <div data-testid="theme-toggle" data-initial-theme={initialTheme} />
  ),
}));

const { UserAccountDialog } = await import('./UserAccountDialog');

afterEach(() => {
  cleanup();
  signOutMock.mockReset();
});

describe('UserAccountDialog', () => {
  it('renders profile and theme when open', () => {
    render(
      <UserAccountDialog
        open
        onOpenChange={vi.fn()}
        userName="Jane Doe"
        userImage={null}
        userInitials="JD"
        initialTheme="dark"
      />,
    );

    expect(screen.getByText('Jane Doe')).toBeDefined();
    expect(screen.getByText('JD')).toBeDefined();
    expect(screen.getByText('Theme')).toBeDefined();
    expect(screen.getByTestId('theme-toggle')).toBeDefined();
  });

  it('calls signOut when Sign out is clicked', () => {
    const onOpenChange = vi.fn();

    render(
      <UserAccountDialog
        open
        onOpenChange={onOpenChange}
        userName="Jane Doe"
        userImage={null}
        userInitials="JD"
        initialTheme="dark"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(signOutMock).toHaveBeenCalled();
  });

  it('does not render content when closed', () => {
    render(
      <UserAccountDialog
        open={false}
        onOpenChange={vi.fn()}
        userName="Jane Doe"
        userImage={null}
        userInitials="JD"
        initialTheme="dark"
      />,
    );

    expect(screen.queryByText('Jane Doe')).toBeNull();
  });
});
