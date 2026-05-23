import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './dropdown-menu';

afterEach(cleanup);

function BasicMenu({
  onSelect,
  open,
  onOpenChange,
}: {
  onSelect?: () => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
}) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={onSelect}>Item one</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Item two</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── open / close ────────────────────────────────────────────────────────────

describe('DropdownMenu — open / close', () => {
  it('is closed by default', () => {
    render(<BasicMenu />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens when trigger is clicked', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('closes when trigger is clicked again', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    fireEvent.click(screen.getByText('Open menu'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes when an item is selected', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    fireEvent.click(screen.getByText('Item one'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape keydown', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on outside pointer-down', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <BasicMenu />
      </div>,
    );
    fireEvent.click(screen.getByText('Open menu'));
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('does not close when clicking inside the menu', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    const menu = screen.getByRole('menu');
    fireEvent.pointerDown(menu);
    expect(screen.getByRole('menu')).toBeDefined();
  });
});

// ─── callbacks ───────────────────────────────────────────────────────────────

describe('DropdownMenu — callbacks', () => {
  it('calls onSelect when item is clicked', () => {
    const onSelect = vi.fn();
    render(<BasicMenu onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Open menu'));
    fireEvent.click(screen.getByText('Item one'));
    expect(onSelect).toHaveBeenCalledOnce();
  });
});

// ─── controlled mode ─────────────────────────────────────────────────────────

describe('DropdownMenu — controlled', () => {
  it('respects open=true prop', () => {
    render(<BasicMenu open onOpenChange={vi.fn()} />);
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('respects open=false prop', () => {
    render(<BasicMenu open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('calls onOpenChange(false) when ESC is pressed', () => {
    const onOpenChange = vi.fn();
    render(<BasicMenu open onOpenChange={onOpenChange} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// ─── ARIA ────────────────────────────────────────────────────────────────────

describe('DropdownMenu — ARIA', () => {
  it('trigger has aria-haspopup=menu', () => {
    render(<BasicMenu />);
    expect(screen.getByText('Open menu').getAttribute('aria-haspopup')).toBe('menu');
  });

  it('trigger has aria-expanded=false when closed', () => {
    render(<BasicMenu />);
    expect(screen.getByText('Open menu').getAttribute('aria-expanded')).toBe('false');
  });

  it('trigger has aria-expanded=true when open', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    expect(screen.getByText('Open menu').getAttribute('aria-expanded')).toBe('true');
  });

  it('content has role=menu', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    expect(screen.getByRole('menu')).toBeDefined();
  });

  it('items have role=menuitem', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    const items = screen.getAllByRole('menuitem');
    expect(items).toHaveLength(2);
  });
});

// ─── data-state ──────────────────────────────────────────────────────────────

describe('DropdownMenu — data-state', () => {
  it('content has data-state=open when open', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    expect(screen.getByRole('menu').getAttribute('data-state')).toBe('open');
  });
});

// ─── asChild trigger ─────────────────────────────────────────────────────────

describe('DropdownMenu — asChild trigger', () => {
  it('renders the child element as the trigger', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="custom-btn">Custom trigger</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    const btn = screen.getByText('Custom trigger');
    expect(btn.className).toContain('custom-btn');
    fireEvent.click(btn);
    expect(screen.getByRole('menu')).toBeDefined();
  });
});

// ─── disabled item ───────────────────────────────────────────────────────────

describe('DropdownMenu — disabled item', () => {
  it('disabled item has data-disabled attribute', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText('Open'));
    const item = screen.getByText('Disabled').closest('[role="menuitem"]')!;
    expect(item.hasAttribute('data-disabled')).toBe(true);
  });

  it('clicking disabled item does not close the menu', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem disabled>Disabled</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText('Open'));
    fireEvent.click(screen.getByText('Disabled'));
    expect(screen.getByRole('menu')).toBeDefined();
  });
});

// ─── keyboard navigation ─────────────────────────────────────────────────────

describe('DropdownMenu — keyboard navigation', () => {
  it('ArrowDown focuses first item when menu opens', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(items[0].getAttribute('data-highlighted')).toBe('true');
  });

  it('ArrowDown moves highlight to next item', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    const items = screen.getAllByRole('menuitem');
    expect(items[1].getAttribute('data-highlighted')).toBe('true');
    expect(items[0].getAttribute('data-highlighted')).not.toBe('true');
  });

  it('ArrowUp moves highlight to previous item', () => {
    render(<BasicMenu />);
    fireEvent.click(screen.getByText('Open menu'));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    const items = screen.getAllByRole('menuitem');
    expect(items[0].getAttribute('data-highlighted')).toBe('true');
  });

  it('Enter activates highlighted item', () => {
    const onSelect = vi.fn();
    render(<BasicMenu onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Open menu'));
    const menu = screen.getByRole('menu');
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

// ─── sub-components (compat stubs) ───────────────────────────────────────────

describe('DropdownMenu — compatibility exports', () => {
  it('DropdownMenuLabel renders text', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Section</DropdownMenuLabel>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByText('Section')).toBeDefined();
  });

  it('DropdownMenuCheckboxItem renders with data-state=checked when checked', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuCheckboxItem checked>Checked option</DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText('Open'));
    const item = screen.getByText('Checked option').closest('[role="menuitemcheckbox"]')!;
    expect(item.getAttribute('data-state')).toBe('checked');
  });

  it('DropdownMenuShortcut renders a span', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>
            Action
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    fireEvent.click(screen.getByText('Open'));
    expect(screen.getByText('⌘K')).toBeDefined();
  });
});
