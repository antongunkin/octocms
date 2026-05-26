import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Slot } from '../Slot/Slot';

afterEach(cleanup);

describe('Slot — basic rendering', () => {
  it('renders the child element, not a wrapper element', () => {
    const { container } = render(
      <Slot>
        <a href="/foo">Link</a>
      </Slot>,
    );
    expect(container.querySelector('a')).not.toBeNull();
    expect(container.querySelector('div')).toBeNull();
  });

  it('passes its own className onto the child', () => {
    render(
      <Slot className="from-slot">
        <a href="/test-link">Link</a>
      </Slot>,
    );
    expect(screen.getByRole('link').className).toContain('from-slot');
  });

  it('merges Slot className with child className', () => {
    render(
      <Slot className="slot-class">
        <a href="/test-link" className="child-class">
          Link
        </a>
      </Slot>,
    );
    const el = screen.getByRole('link');
    expect(el.className).toContain('slot-class');
    expect(el.className).toContain('child-class');
  });

  it('forwards Slot props to the child', () => {
    render(
      <Slot data-testid="forwarded" aria-label="test">
        <button>Click</button>
      </Slot>,
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('test');
    expect(screen.getByTestId('forwarded')).toBeDefined();
  });

  it('child props override Slot props for non-merging props', () => {
    render(
      <Slot aria-label="slot-label">
        <button aria-label="child-label">Click</button>
      </Slot>,
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('child-label');
  });
});

describe('Slot — event handler composition', () => {
  it('calls Slot onClick handler', () => {
    const onSlot = vi.fn();
    render(
      <Slot onClick={onSlot}>
        <button>Click</button>
      </Slot>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSlot).toHaveBeenCalledOnce();
  });

  it('calls child onClick handler', () => {
    const onChild = vi.fn();
    render(
      <Slot>
        <button onClick={onChild}>Click</button>
      </Slot>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onChild).toHaveBeenCalledOnce();
  });

  it('calls both Slot and child onClick handlers', () => {
    const onSlot = vi.fn();
    const onChild = vi.fn();
    render(
      <Slot onClick={onSlot}>
        <button onClick={onChild}>Click</button>
      </Slot>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onSlot).toHaveBeenCalledOnce();
    expect(onChild).toHaveBeenCalledOnce();
  });

  it('child handler fires before Slot handler', () => {
    const order: string[] = [];
    render(
      <Slot onClick={() => order.push('slot')}>
        <button onClick={() => order.push('child')}>Click</button>
      </Slot>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(order).toEqual(['child', 'slot']);
  });
});

describe('Slot — ref forwarding', () => {
  it('attaches the Slot ref to the child DOM node', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(
      <Slot ref={ref}>
        <button>Click</button>
      </Slot>,
    );
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });

  it('composes Slot ref and child ref', () => {
    const slotRef = React.createRef<HTMLButtonElement>();
    const childRef = React.createRef<HTMLButtonElement>();
    render(
      <Slot ref={slotRef}>
        <button ref={childRef}>Click</button>
      </Slot>,
    );
    expect(slotRef.current).toBeInstanceOf(HTMLButtonElement);
    expect(childRef.current).toBe(slotRef.current);
  });
});
