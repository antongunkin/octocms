import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Button, buttonVariants } from './Button';

afterEach(cleanup);

describe('buttonVariants', () => {
  it('includes octo-button base class', () => {
    expect(buttonVariants()).toContain('octo-button');
  });

  it('includes variant modifier', () => {
    expect(buttonVariants({ variant: 'primary' })).toContain('octo-button--primary');
  });

  it('includes size modifier (non-default)', () => {
    expect(buttonVariants({ size: 'lg' })).toContain('octo-button--lg');
  });

  it('appends extra className', () => {
    expect(buttonVariants({ className: 'extra' })).toContain('extra');
  });
});

describe('Button', () => {
  it('renders a <button> by default', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button').tagName).toBe('BUTTON');
  });

  it('has the base octo-button class', () => {
    render(<Button>Click</Button>);
    expect(screen.getByRole('button').className).toContain('octo-button');
  });

  it('applies variant class', () => {
    render(<Button variant="primary">Click</Button>);
    expect(screen.getByRole('button').className).toContain('octo-button--primary');
  });

  it('forwards ref to the button element', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Click</Button>);
    expect(ref.current?.tagName).toBe('BUTTON');
  });

  it('passes onClick and fires it', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders an icon when provided', () => {
    render(<Button icon={<span data-testid="ico" />}>Click</Button>);
    expect(screen.getByTestId('ico')).toBeDefined();
  });
});

describe('Button asChild', () => {
  it('renders the child element instead of a button', () => {
    render(
      <Button asChild>
        <a href="/foo">Link</a>
      </Button>,
    );
    expect(screen.getByRole('link').tagName).toBe('A');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('passes octo-button class onto the child anchor', () => {
    render(
      <Button asChild>
        <a href="/foo">Link</a>
      </Button>,
    );
    expect(screen.getByRole('link').className).toContain('octo-button');
  });

  it('forwards ref to the child element', () => {
    const ref = React.createRef<HTMLAnchorElement>();
    render(
      <Button asChild ref={ref as React.Ref<HTMLButtonElement>}>
        <a href="/foo">Link</a>
      </Button>,
    );
    expect(ref.current?.tagName).toBe('A');
  });

  it('composes onClick with child onClick', () => {
    const onButton = vi.fn();
    const onAnchor = vi.fn();
    render(
      <Button asChild onClick={onButton}>
        <a href="/foo" onClick={onAnchor}>
          Link
        </a>
      </Button>,
    );
    fireEvent.click(screen.getByRole('link'));
    expect(onButton).toHaveBeenCalledOnce();
    expect(onAnchor).toHaveBeenCalledOnce();
  });
});
