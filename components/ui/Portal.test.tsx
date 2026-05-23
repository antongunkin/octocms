import { render, screen } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import { Portal } from './Portal';

describe('Portal', () => {
  it('renders children into document.body by default', () => {
    render(
      <Portal>
        <div data-testid="inner">hello</div>
      </Portal>,
    );
    expect(document.body.querySelector('[data-testid="inner"]')).not.toBeNull();
  });

  it('renders into a custom container', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    render(
      <Portal container={container}>
        <span data-testid="custom">hi</span>
      </Portal>,
    );
    expect(container.querySelector('[data-testid="custom"]')).not.toBeNull();
    document.body.removeChild(container);
  });

  it('child is accessible via Testing Library queries', () => {
    render(
      <div>
        <Portal>
          <button>Portal Button</button>
        </Portal>
      </div>,
    );
    expect(screen.getByRole('button', { name: 'Portal Button' })).toBeDefined();
  });

  it('does not render inside the parent DOM node', () => {
    const { container } = render(
      <div data-testid="parent">
        <Portal>
          <span data-testid="child">out</span>
        </Portal>
      </div>,
    );
    expect(container.querySelector('[data-testid="child"]')).toBeNull();
  });
});
