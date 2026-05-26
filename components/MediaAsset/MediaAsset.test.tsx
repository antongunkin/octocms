import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaFile } from '../../types';
import MediaAsset from './MediaAsset';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { pushMock, openMock, getMediaEntriesMock, updateMediaMetadataMock, moveMediaMock, deleteMediaMock } = vi.hoisted(
  () => ({
    pushMock: vi.fn(),
    openMock: vi.fn(),
    getMediaEntriesMock: vi.fn(),
    updateMediaMetadataMock: vi.fn(),
    moveMediaMock: vi.fn(),
    deleteMediaMock: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../../admin/actions/media', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
  uploadMedia: vi.fn(),
  updateMediaMetadata: (...a: unknown[]) => updateMediaMetadataMock(...a),
  moveMedia: (...a: unknown[]) => moveMediaMock(...a),
  deleteMedia: (...a: unknown[]) => deleteMediaMock(...a),
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

function renderWithFiles(allFiles: MediaFile[], id: string) {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.media.list(), allFiles);
  return renderWithQuery(<MediaAsset id={id} />, { client });
}

beforeEach(() => {
  pushMock.mockReset();
  openMock.mockReset();
  getMediaEntriesMock.mockReset();
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
  it('renders block-level skeletons while the media list is loading', () => {
    getMediaEntriesMock.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<MediaAsset id={mockFile.id} />);

    expect(screen.getByLabelText('Loading preview')).toBeDefined();
    expect(screen.getByLabelText('Loading metadata')).toBeDefined();
  });

  it('renders an empty state when the asset is not in the list', () => {
    renderWithFiles([], 'missing-id');
    expect(screen.getByText(/Asset not found/i)).toBeDefined();
  });

  it('saves a new title via updateMediaMetadata', async () => {
    updateMediaMetadataMock.mockResolvedValueOnce({ success: true });
    renderWithFiles([mockFile], mockFile.id);

    const input = screen.getByLabelText(/title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Updated title' } });
    fireEvent.click(screen.getByRole('button', { name: /save title/i }));

    await waitFor(() => expect(updateMediaMetadataMock).toHaveBeenCalledWith('abc-123', 'Updated title'));
  });

  it('opens the public URL in a new tab', () => {
    renderWithFiles([mockFile], mockFile.id);
    fireEvent.click(screen.getByRole('button', { name: /open in new tab/i }));
    expect(openMock).toHaveBeenCalledWith('/media/abc-123.png', '_blank', 'noopener,noreferrer');
  });

  it('deletes and redirects to /cms/media on success', async () => {
    deleteMediaMock.mockResolvedValueOnce({ success: true });
    renderWithFiles([mockFile], mockFile.id);

    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    fireEvent.click(screen.getAllByRole('button', { name: /delete/i }).pop()!);

    await waitFor(() => expect(deleteMediaMock).toHaveBeenCalledWith('abc-123'));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/cms/media'));
  });

  it('Save folder is disabled until the dropdown changes (no auto-save)', () => {
    moveMediaMock.mockResolvedValueOnce({ success: true });
    const otherInBlog: MediaFile = { ...mockFile, id: 'other', folder: 'blog' };
    renderWithFiles([mockFile, otherInBlog], mockFile.id);

    const saveBtn = screen.getByRole('button', { name: /save folder/i });
    expect(saveBtn).toHaveProperty('disabled', true);
    expect(moveMediaMock).not.toHaveBeenCalled();
  });

  it('Save title is disabled when the title field has not changed', () => {
    renderWithFiles([mockFile], mockFile.id);
    const saveBtn = screen.getByRole('button', { name: /save title/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it('Save title becomes enabled once the title is edited', () => {
    renderWithFiles([mockFile], mockFile.id);
    const input = screen.getByLabelText(/title/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Different' } });
    const saveBtn = screen.getByRole('button', { name: /save title/i }) as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(false);
  });

  it('renders read-only file metadata rows', () => {
    renderWithFiles([mockFile], mockFile.id);
    expect(screen.getByText('a.png')).toBeDefined();
    expect(screen.getByText('PNG')).toBeDefined();
    expect(screen.getByText('800 × 600')).toBeDefined();
    expect(screen.getByText('/media/abc-123.png')).toBeDefined();
    expect(screen.getByText('abc-123')).toBeDefined();
  });
});
