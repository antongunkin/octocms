import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaLeftPanel } from './MediaLeftPanel';

afterEach(cleanup);

const baseProps = {
  folders: ['/', 'blog', 'campaigns'],
  selectedFolder: null as string | null,
  countByFolder: { '/': 1, blog: 2, campaigns: 0 } as Record<string, number>,
  totalCount: 3,
  customFolders: ['campaigns'],
  onSelectAll: () => {},
  onSelectFolder: (_: string) => {},
  onAddFolder: () => {},
  onDeleteFolder: (_: string) => {},
};

describe('MediaLeftPanel', () => {
  it('renders "All files" with the total count and Folders section', () => {
    render(<MediaLeftPanel {...baseProps} />);
    expect(screen.getByText('All files')).toBeDefined();
    expect(screen.getByText('Folders')).toBeDefined();
    expect(screen.getByText('Root')).toBeDefined();
    expect(screen.getByText('blog')).toBeDefined();
    expect(screen.getByText('campaigns')).toBeDefined();
  });

  it('clicking "All files" calls onSelectAll', () => {
    const onSelectAll = vi.fn();
    render(<MediaLeftPanel {...baseProps} onSelectAll={onSelectAll} />);
    fireEvent.click(screen.getByText('All files'));
    expect(onSelectAll).toHaveBeenCalled();
  });

  it('clicking a folder calls onSelectFolder with the folder name', () => {
    const onSelectFolder = vi.fn();
    render(<MediaLeftPanel {...baseProps} onSelectFolder={onSelectFolder} />);
    fireEvent.click(screen.getByText('blog'));
    expect(onSelectFolder).toHaveBeenCalledWith('blog');
  });

  it('clicking the + button calls onAddFolder', () => {
    const onAddFolder = vi.fn();
    render(<MediaLeftPanel {...baseProps} onAddFolder={onAddFolder} />);
    fireEvent.click(screen.getByRole('button', { name: /add folder/i }));
    expect(onAddFolder).toHaveBeenCalled();
  });

  it('renders a delete X for custom folders only', () => {
    render(<MediaLeftPanel {...baseProps} />);
    // campaigns is in customFolders → delete X exists
    expect(screen.queryByRole('button', { name: /delete folder campaigns/i })).not.toBeNull();
    // blog is derived from media files (not custom) → no delete X
    expect(screen.queryByRole('button', { name: /delete folder blog/i })).toBeNull();
    // Root is never deletable
    expect(screen.queryByRole('button', { name: /delete folder \//i })).toBeNull();
  });

  it('the delete X is rendered as a sibling of LeftNavItem (not nested in its button)', () => {
    render(<MediaLeftPanel {...baseProps} />);
    const deleteBtn = screen.getByRole('button', { name: /delete folder campaigns/i });
    // Walk up — there must be NO <button> ancestor before the row's `.group` wrapper.
    let node: HTMLElement | null = deleteBtn.parentElement;
    while (node && !node.classList.contains('group')) {
      expect(node.tagName.toLowerCase()).not.toBe('button');
      node = node.parentElement;
    }
    expect(node).not.toBeNull();
  });

  it('the delete X starts hidden via group-hover:flex (no overlap with the count)', () => {
    render(<MediaLeftPanel {...baseProps} />);
    const deleteBtn = screen.getByRole('button', { name: /delete folder campaigns/i });
    expect(deleteBtn.className).toMatch(/\bhidden\b/);
    expect(deleteBtn.className).toMatch(/group-hover:flex/);
  });

  it('clicking the delete X calls onDeleteFolder and stops propagation to the row', () => {
    const onDeleteFolder = vi.fn();
    const onSelectFolder = vi.fn();
    render(<MediaLeftPanel {...baseProps} onDeleteFolder={onDeleteFolder} onSelectFolder={onSelectFolder} />);
    fireEvent.click(screen.getByRole('button', { name: /delete folder campaigns/i }));
    expect(onDeleteFolder).toHaveBeenCalledWith('campaigns');
    expect(onSelectFolder).not.toHaveBeenCalledWith('campaigns');
  });

  it('marks the active folder visually', () => {
    render(<MediaLeftPanel {...baseProps} selectedFolder="blog" />);
    const blogButton = screen.getByText('blog').closest('button');
    expect(blogButton?.className).toMatch(/font-semibold/);
    expect(blogButton?.className).toMatch(/bg-\[var\(--surface-3\)\]/);
  });

  it('"All files" is active when selectedFolder is null', () => {
    render(<MediaLeftPanel {...baseProps} selectedFolder={null} />);
    const all = screen.getByText('All files').closest('button');
    expect(all?.className).toMatch(/font-semibold/);
  });
});
