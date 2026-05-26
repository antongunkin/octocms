import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Switcher, SwitcherItem } from './Switcher';

afterEach(cleanup);

describe('Switcher', () => {
  it('renders a tablist with switcher classes', () => {
    render(
      <Switcher aria-label="Example">
        <SwitcherItem active>One</SwitcherItem>
      </Switcher>,
    );
    expect(screen.getByRole('tablist').className).toContain('octo-switcher');
  });

  it('marks the active item with aria-selected and data-state', () => {
    render(
      <Switcher aria-label="Example">
        <SwitcherItem active>Active</SwitcherItem>
        <SwitcherItem>Inactive</SwitcherItem>
      </Switcher>,
    );
    expect(screen.getByRole('tab', { name: 'Active' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Active' }).getAttribute('data-state')).toBe('active');
    expect(screen.getByRole('tab', { name: 'Inactive' }).getAttribute('data-state')).toBe('inactive');
  });

  it('calls onClick when an item is clicked', () => {
    const onClick = vi.fn();
    render(
      <Switcher aria-label="Example">
        <SwitcherItem onClick={onClick}>Two</SwitcherItem>
      </Switcher>,
    );
    fireEvent.click(screen.getByRole('tab', { name: 'Two' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('icon items use the icon modifier class', () => {
    render(
      <Switcher aria-label="Example">
        <SwitcherItem icon aria-label="Grid">
          G
        </SwitcherItem>
      </Switcher>,
    );
    expect(screen.getByRole('tab', { name: 'Grid' }).className).toContain('octo-switcher__item--icon');
  });

  it('forwards ref on Switcher and SwitcherItem', () => {
    const listRef = React.createRef<HTMLDivElement>();
    const itemRef = React.createRef<HTMLButtonElement>();
    render(
      <Switcher ref={listRef} aria-label="Example">
        <SwitcherItem ref={itemRef}>One</SwitcherItem>
      </Switcher>,
    );
    expect(listRef.current?.getAttribute('role')).toBe('tablist');
    expect(itemRef.current?.tagName).toBe('BUTTON');
  });

  it('disabled items expose data-disabled', () => {
    render(
      <Switcher aria-label="Example">
        <SwitcherItem disabled>Off</SwitcherItem>
      </Switcher>,
    );
    expect(screen.getByRole('tab', { name: 'Off' }).hasAttribute('data-disabled')).toBe(true);
  });

  it('ArrowRight moves focus and activates the next item', () => {
    const onSecond = vi.fn();
    render(
      <Switcher aria-label="Example">
        <SwitcherItem active>One</SwitcherItem>
        <SwitcherItem onClick={onSecond}>Two</SwitcherItem>
      </Switcher>,
    );
    screen.getByRole('tab', { name: 'One' }).focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Two' }));
    expect(onSecond).toHaveBeenCalledTimes(1);
  });

  it('ArrowRight skips disabled items', () => {
    render(
      <Switcher aria-label="Example">
        <SwitcherItem active>One</SwitcherItem>
        <SwitcherItem disabled>Two</SwitcherItem>
        <SwitcherItem>Three</SwitcherItem>
      </Switcher>,
    );
    screen.getByRole('tab', { name: 'One' }).focus();
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Three' }));
  });

  it('normalizes mapped children with explicit keys', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const items = ['grid', 'list'] as const;
    render(
      <Switcher aria-label="Example">
        {items.map((mode) => (
          <SwitcherItem key={mode} active={mode === 'grid'}>
            {mode}
          </SwitcherItem>
        ))}
      </Switcher>,
    );
    expect(consoleError.mock.calls.filter((call) => String(call[0]).includes('unique "key" prop'))).toHaveLength(0);
    consoleError.mockRestore();
  });
});
