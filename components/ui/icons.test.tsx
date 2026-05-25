import { cleanup, render } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { Icon } from './icons';

afterEach(() => {
  cleanup();
});

describe('icons', () => {
  it('applies size, color, strokeWidth, and absoluteStrokeWidth', () => {
    const { container } = render(<Icon.Search size={32} color="tomato" strokeWidth={3} absoluteStrokeWidth />);
    const svg = container.querySelector('svg');

    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
    expect(svg?.getAttribute('stroke')).toBe('tomato');
    expect(svg?.getAttribute('stroke-width')).toBe('2.25');
  });

  it('keeps aria labels and icon aliases working', () => {
    const { container } = render(<Icon.ImageIcon aria-label="image" />);
    const svg = container.querySelector('svg');

    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toBe('image');
    expect(svg?.getAttribute('aria-hidden')).toBeNull();
    expect(Icon.ImageIcon).toBe(Icon.Image);
  });
});
