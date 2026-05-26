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

  it('renders added lines with a + gutter and add BEM modifier', () => {
    const { container } = render(<DiffHunk before={'a\nb\n'} after={'a\nb\nc\n'} />);
    const added = container.querySelector('.octo-diff-hunk__line--add');
    expect(added).toBeTruthy();
    expect(added!.textContent).toContain('+');
    expect(added!.textContent).toContain('c');
  });

  it('renders removed lines with a − gutter and del BEM modifier', () => {
    const { container } = render(<DiffHunk before={'a\nb\nc\n'} after={'a\nb\n'} />);
    const removed = container.querySelector('.octo-diff-hunk__line--del');
    expect(removed).toBeTruthy();
    expect(removed!.textContent).toContain('−');
    expect(removed!.textContent).toContain('c');
  });

  it('shows both a − and a + line when a line is changed', () => {
    const { container } = render(<DiffHunk before={'hello world'} after={'hello there'} />);
    expect(container.querySelector('.octo-diff-hunk__line--del')).toBeTruthy();
    expect(container.querySelector('.octo-diff-hunk__line--add')).toBeTruthy();
  });

  it('omits line-number gutters by default', () => {
    const { container } = render(<DiffHunk before={'a'} after={'b'} />);
    // Line-number spans use octo-diff-hunk__line-num; sign span uses octo-diff-hunk__line-sign.
    expect(container.querySelector('.octo-diff-hunk__line-num')).toBeNull();
    expect(container.querySelector('.octo-diff-hunk__line-sign')).toBeTruthy();
  });

  it('renders line-number gutters when showLineNumbers is true', () => {
    const { container } = render(<DiffHunk before={'a\nb'} after={'a\nc'} showLineNumbers />);
    const gutters = container.querySelectorAll('.octo-diff-hunk__line-num');
    // Two gutters (before/after) on each rendered row.
    expect(gutters.length).toBeGreaterThanOrEqual(4);
  });

  it('passes through an extra className on the outer container', () => {
    const { container } = render(<DiffHunk before={'a'} after={'b'} className="custom-class" />);
    expect(container.querySelector('.custom-class')).toBeTruthy();
  });
});
