import { cleanup, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { DiffHunk } from './DiffHunk';

afterEach(() => cleanup());

describe('DiffHunk', () => {
  it('renders context-only lines when before === after', () => {
    const { container } = render(<DiffHunk before={'line a\nline b'} after={'line a\nline b'} />);
    expect(screen.getByText('line a')).toBeTruthy();
    expect(screen.getByText('line b')).toBeTruthy();
    // No + or − gutter markers.
    expect(container.textContent).not.toMatch(/[+−]/);
  });

  it('renders added lines with a + gutter and emerald background classes', () => {
    const { container } = render(<DiffHunk before={'a\nb\n'} after={'a\nb\nc\n'} />);
    const added = container.querySelector('.bg-emerald-50');
    expect(added).toBeTruthy();
    expect(added!.textContent).toContain('+');
    expect(added!.textContent).toContain('c');
  });

  it('renders removed lines with a − gutter and red background classes', () => {
    const { container } = render(<DiffHunk before={'a\nb\nc\n'} after={'a\nb\n'} />);
    const removed = container.querySelector('.bg-red-50');
    expect(removed).toBeTruthy();
    expect(removed!.textContent).toContain('−');
    expect(removed!.textContent).toContain('c');
  });

  it('shows both a − and a + line when a line is changed', () => {
    const { container } = render(<DiffHunk before={'hello world'} after={'hello there'} />);
    expect(container.querySelector('.bg-red-50')).toBeTruthy();
    expect(container.querySelector('.bg-emerald-50')).toBeTruthy();
  });

  it('omits line-number gutters by default', () => {
    const { container } = render(<DiffHunk before={'a'} after={'b'} />);
    // Line-number spans have the distinctive `w-9` width; gutter sign span is `w-6`.
    expect(container.querySelector('span.w-9')).toBeNull();
    expect(container.querySelector('span.w-6')).toBeTruthy();
  });

  it('renders line-number gutters when showLineNumbers is true', () => {
    const { container } = render(<DiffHunk before={'a\nb'} after={'a\nc'} showLineNumbers />);
    const gutters = container.querySelectorAll('span.w-9');
    // Two gutters (before/after) on each rendered row.
    expect(gutters.length).toBeGreaterThanOrEqual(4);
  });

  it('passes through an extra className on the outer container', () => {
    const { container } = render(<DiffHunk before={'a'} after={'b'} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});
