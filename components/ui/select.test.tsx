import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './select';

afterEach(cleanup);

function BasicSelect({
  value,
  defaultValue,
  onValueChange,
  placeholder = 'Choose…',
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <Select value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="apple">Apple</SelectItem>
        <SelectItem value="banana">Banana</SelectItem>
        <SelectItem value="cherry">Cherry</SelectItem>
      </SelectContent>
    </Select>
  );
}

// ─── open / close ────────────────────────────────────────────────────────────

describe('Select — open / close', () => {
  it('is closed by default', () => {
    render(<BasicSelect />);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('opens when trigger is clicked', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('closes when trigger is clicked again', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes when an item is selected', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Apple'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on Escape keydown', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('closes on outside pointer-down', () => {
    render(
      <div>
        <div data-testid="outside">outside</div>
        <BasicSelect />
      </div>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.pointerDown(screen.getByTestId('outside'));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─── value display ───────────────────────────────────────────────────────────

describe('Select — value display', () => {
  it('shows placeholder when no value', () => {
    render(<BasicSelect placeholder="Pick one" />);
    expect(screen.getByText('Pick one')).toBeDefined();
  });

  it('shows placeholder (not [object Object]) when options use JSX labels and no value is selected', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">
            <span>
              <strong>Apple</strong>
            </span>
          </SelectItem>
          <SelectItem value="banana">
            <span>
              <em>Banana</em>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox').textContent).toContain('Pick one');
    expect(screen.getByRole('combobox').textContent).not.toContain('[object Object]');
  });

  it('shows selected label for defaultValue', () => {
    render(<BasicSelect defaultValue="banana" />);
    expect(screen.getByRole('combobox').textContent).toContain('Banana');
  });

  it('updates display when controlled value changes', () => {
    const { rerender } = render(<BasicSelect value="apple" onValueChange={vi.fn()} />);
    expect(screen.getByRole('combobox').textContent).toContain('Apple');
    rerender(<BasicSelect value="cherry" onValueChange={vi.fn()} />);
    expect(screen.getByRole('combobox').textContent).toContain('Cherry');
  });

  it('shows selected JSX item text instead of [object Object]', () => {
    render(
      <Select defaultValue="apple">
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="apple">
            <span>
              <strong>Apple</strong>
            </span>
          </SelectItem>
          <SelectItem value="banana">
            <span>
              <em>Banana</em>
            </span>
          </SelectItem>
        </SelectContent>
      </Select>,
    );

    expect(screen.getByRole('combobox').textContent).toContain('Apple');
    expect(screen.getByRole('combobox').textContent).not.toContain('[object Object]');
  });
});

// ─── selection callbacks ─────────────────────────────────────────────────────

describe('Select — selection', () => {
  it('calls onValueChange with the selected value', () => {
    const onValueChange = vi.fn();
    render(<BasicSelect onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Banana'));
    expect(onValueChange).toHaveBeenCalledWith('banana');
  });

  it('uncontrolled: updates displayed value after selection', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Cherry'));
    expect(screen.getByRole('combobox').textContent).toContain('Cherry');
  });
});

// ─── ARIA ────────────────────────────────────────────────────────────────────

describe('Select — ARIA', () => {
  it('trigger has role=combobox', () => {
    render(<BasicSelect />);
    expect(screen.getByRole('combobox')).toBeDefined();
  });

  it('trigger has aria-expanded=false when closed', () => {
    render(<BasicSelect />);
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('false');
  });

  it('trigger has aria-expanded=true when open', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('combobox').getAttribute('aria-expanded')).toBe('true');
  });

  it('content has role=listbox', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('items have role=option', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getAllByRole('option')).toHaveLength(3);
  });

  it('selected item has aria-selected=true', () => {
    render(<BasicSelect defaultValue="banana" />);
    fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    const banana = options.find((o) => o.textContent?.includes('Banana'))!;
    expect(banana.getAttribute('aria-selected')).toBe('true');
  });
});

// ─── data-state ──────────────────────────────────────────────────────────────

describe('Select — data-state', () => {
  it('selected item has data-state=checked', () => {
    render(<BasicSelect defaultValue="apple" />);
    fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    const apple = options.find((o) => o.textContent?.includes('Apple'))!;
    expect(apple.getAttribute('data-state')).toBe('checked');
  });

  it('unselected item has data-state=unchecked', () => {
    render(<BasicSelect defaultValue="apple" />);
    fireEvent.click(screen.getByRole('combobox'));
    const options = screen.getAllByRole('option');
    const banana = options.find((o) => o.textContent?.includes('Banana'))!;
    expect(banana.getAttribute('data-state')).toBe('unchecked');
  });

  it('content has data-state=open when open', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByRole('listbox').getAttribute('data-state')).toBe('open');
  });
});

// ─── keyboard navigation ─────────────────────────────────────────────────────

describe('Select — keyboard navigation', () => {
  it('ArrowDown highlights first option', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('data-highlighted')).toBe('true');
  });

  it('ArrowDown moves highlight to next option', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    const options = screen.getAllByRole('option');
    expect(options[1].getAttribute('data-highlighted')).toBe('true');
  });

  it('ArrowUp moves highlight upward', () => {
    render(<BasicSelect />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('data-highlighted')).toBe('true');
  });

  it('Enter selects highlighted option and closes', () => {
    const onValueChange = vi.fn();
    render(<BasicSelect onValueChange={onValueChange} />);
    fireEvent.click(screen.getByRole('combobox'));
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(onValueChange).toHaveBeenCalledWith('apple');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

// ─── disabled item ───────────────────────────────────────────────────────────

describe('Select — disabled item', () => {
  it('disabled item has data-disabled attribute', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ok">OK</SelectItem>
          <SelectItem value="bad" disabled>
            Disabled
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    const disabled = screen.getByText('Disabled').closest('[role="option"]')!;
    expect(disabled.hasAttribute('data-disabled')).toBe(true);
  });

  it('clicking a disabled item does not update value', () => {
    const onValueChange = vi.fn();
    render(
      <Select onValueChange={onValueChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ok">OK</SelectItem>
          <SelectItem value="bad" disabled>
            Disabled
          </SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    fireEvent.click(screen.getByText('Disabled'));
    expect(onValueChange).not.toHaveBeenCalled();
  });
});

// ─── compat exports (SelectGroup, SelectLabel, SelectSeparator) ───────────────

describe('Select — compat exports', () => {
  it('SelectGroup renders children', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Fruits</SelectLabel>
            <SelectItem value="a">Apple</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(screen.getByText('Fruits')).toBeDefined();
  });

  it('SelectSeparator renders', () => {
    render(
      <Select>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="a">A</SelectItem>
          <SelectSeparator />
          <SelectItem value="b">B</SelectItem>
        </SelectContent>
      </Select>,
    );
    fireEvent.click(screen.getByRole('combobox'));
    expect(document.querySelector('.octo-select__separator')).toBeDefined();
  });
});
