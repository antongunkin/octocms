import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DeleteFolderDialog } from './DeleteFolderDialog';

afterEach(cleanup);

describe('DeleteFolderDialog', () => {
  it('is hidden when folderName is null', () => {
    render(<DeleteFolderDialog folderName={null} fileCount={0} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText(/Delete folder/i)).toBeNull();
  });

  it('shows the confirm copy when the folder is empty', () => {
    render(<DeleteFolderDialog folderName="campaigns" fileCount={0} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/Remove the folder/i)).toBeDefined();
    expect(screen.getByText(/campaigns/)).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^delete folder$/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(false);
  });

  it('blocks deletion and disables the confirm button when files remain', () => {
    render(<DeleteFolderDialog folderName="blog" fileCount={3} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/still contains 3 files/i)).toBeDefined();
    const confirmBtn = screen.getByRole('button', { name: /^delete folder$/i }) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
  });

  it('uses singular copy for fileCount === 1', () => {
    render(<DeleteFolderDialog folderName="blog" fileCount={1} onConfirm={() => {}} onCancel={() => {}} />);
    expect(screen.getByText(/still contains 1 file\./i)).toBeDefined();
  });

  it('clicking Cancel calls onCancel', () => {
    const onCancel = vi.fn();
    render(<DeleteFolderDialog folderName="campaigns" fileCount={0} onConfirm={() => {}} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('clicking Delete folder calls onConfirm when not blocked', () => {
    const onConfirm = vi.fn();
    render(<DeleteFolderDialog folderName="campaigns" fileCount={0} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete folder$/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('clicking the disabled Delete folder button does not call onConfirm', () => {
    const onConfirm = vi.fn();
    render(<DeleteFolderDialog folderName="blog" fileCount={2} onConfirm={onConfirm} onCancel={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^delete folder$/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
