import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaFile } from '../../types';
import { MediaAsset } from './MediaAsset';

const pushMock = vi.fn();
const openMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

const updateMediaMetadataMock = vi.fn();
const moveMediaMock = vi.fn();
const deleteMediaMock = vi.fn();

vi.mock('octocms/admin/actions', () => ({
  updateMediaMetadata: (...args: unknown[]) => updateMediaMetadataMock(...args),
  moveMedia: (...args: unknown[]) => moveMediaMock(...args),
  deleteMedia: (...args: unknown[]) => deleteMediaMock(...args),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

const mockFile: MediaFile = {
  id: 'abc-123',
  title: 'A test',
  originalName: 'a.png',
  path: 'public/media/abc-123.png',
  folder: '/',
  publicUrl: '/media/abc-123.png',
  extension: 'png',
  width: 800,
  height: 600,
  hasBlurPlaceholder: false,
};

beforeEach(() => {
  pushMock.mockReset();
  openMock.mockReset();
  updateMediaMetadataMock.mockReset();
  moveMediaMock.mockReset();
  deleteMediaMock.mockReset();
  window.localStorage.clear();
  vi.stubGlobal('open', openMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MediaAsset', () => {
  it('saves a new title via updateMediaMetadata', async () => {
    updateMediaMetadataMock.mockResolvedValueOnce({ success: true });
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);

    const input = screen.getByLabelText(/title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: /save title/i }));

    await waitFor(() => expect(updateMediaMetadataMock).toHaveBeenCalledWith('abc-123', 'Updated title'));
  });

  it('opens the public URL in a new tab', () => {
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);
    fireEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
    expect(openMock).toHaveBeenCalledWith('/media/abc-123.png', '_blank', 'noopener,noreferrer');
  });

  it('deletes and redirects to /cms/media on success', async () => {
    deleteMediaMock.mockResolvedValueOnce({ success: true });
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i }).pop()!);

    await waitFor(() => expect(deleteMediaMock).toHaveBeenCalledWith('abc-123'));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cms/media'));
  });

  it('Save folder is disabled until the dropdown changes (no auto-save)', () => {
    moveMediaMock.mockResolvedValueOnce({ success: true });
    const otherInBlog: MediaFile = { ...mockFile, id: 'other', folder: 'blog' };
    render(<MediaAsset file={mockFile} allFiles={[mockFile, otherInBlog]} />);

    const saveBtn = screen.getByRole('button', { name: /save folder/i });
    expect(saveBtn).toHaveProperty('disabled', true);
    expect(moveMediaMock).not.toHaveBeenCalled();
  });

  it('Save title is disabled when the title field has not changed', () => {
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);
    const saveBtn = screen.getByRole('button', { name: /save title/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('Save title becomes enabled once the title is edited', () => {
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);
    const input = screen.getByLabelText(/title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Different' } });
    const saveBtn = screen.getByRole('button', { name: /save title/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('renders read-only file metadata rows', () => {
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);
    expect(screen.getByText('a.png')).toBeDefined();
    expect(screen.getByText('PNG')).toBeDefined();
    expect(screen.getByText('800 × 600')).toBeDefined();
    expect(screen.getByText('/media/abc-123.png')).toBeDefined();
    expect(screen.getByText('abc-123')).toBeDefined();
  });

  it('back arrow returns to /cms/media', () => {
    render(<MediaAsset file={mockFile} allFiles={[mockFile]} />);
    fireEvent.click(screen.getByRole('button', { name: /back to media/i }));
    expect(pushMock).toHaveBeenCalledWith('/cms/media');
  });
});
