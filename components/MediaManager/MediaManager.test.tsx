import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaFile } from '../../types';
import MediaManager from './MediaManager';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { pushMock, openMock, getMediaEntriesMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  openMock: vi.fn(),
  getMediaEntriesMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock('../../admin/actions/media', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
  uploadMedia: vi.fn(),
  deleteMedia: vi.fn(),
  moveMedia: vi.fn(),
  updateMediaMetadata: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png', 'jpg'],
    git: { baseBranch: 'main' },
    collections: {},
  }),
}));

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

function renderWithFiles(files: MediaFile[]) {
  const client = createTestQueryClient();
  client.setQueryData(queryKeys.media.list(), files);
  return renderWithQuery(<MediaManager />, { client });
}

beforeEach(() => {
  pushMock.mockReset();
  openMock.mockReset();
  getMediaEntriesMock.mockReset();
  window.localStorage.clear();
  vi.stubGlobal('open', openMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MediaManager', () => {
  it('shows block-level skeletons while the media query is loading', () => {
    getMediaEntriesMock.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<MediaManager />);

    expect(screen.getByLabelText('Loading folders')).toBeDefined();
    expect(screen.getByLabelText('Loading media grid')).toBeDefined();
  });

  it('navigates to /cms/media/[id] when a card is clicked', () => {
    renderWithFiles([mockFile]);
    const card = screen.getByText('A test').closest('button');
    expect(card).not.toBeNull();
    fireEvent.click(card!);
    expect(pushMock).toHaveBeenCalledWith('/cms/media/abc-123');
  });

  it('persists newly created folders to localStorage', () => {
    renderWithFiles([mockFile]);
    fireEvent.click(screen.getByRole('button', { name: /add folder/i }));
    const input = screen.getByPlaceholderText(/blog-posts/);
    fireEvent.change(input, { target: { value: 'campaigns' } });
    fireEvent.click(screen.getByRole('button', { name: /create folder/i }));

    const stored = JSON.parse(window.localStorage.getItem('octocms:media-custom-folders') || '[]');
    expect(stored).toContain('campaigns');
  });

  it('grid cards no longer render an "asset actions" overflow menu', () => {
    renderWithFiles([mockFile]);
    expect(screen.queryByRole('button', { name: /asset actions/i })).toBeNull();
  });

  it('search input filters cards by title and originalName', async () => {
    const files = [
      { ...mockFile, id: 'a', title: 'Hero shot', originalName: 'hero.png' },
      { ...mockFile, id: 'b', title: 'Logo mark', originalName: 'logo.svg', extension: 'svg' },
    ];
    renderWithFiles(files);
    expect(screen.getByText('Hero shot')).toBeDefined();
    expect(screen.getByText('Logo mark')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText(/Filter assets/i), { target: { value: 'logo' } });
    await waitFor(() => expect(screen.queryByText('Hero shot')).toBeNull());
    expect(screen.getByText('Logo mark')).toBeDefined();
  });

  it('pressing "/" focuses the search input', () => {
    renderWithFiles([mockFile]);
    const input = screen.getByPlaceholderText(/Filter assets/i) as HTMLInputElement;
    expect(document.activeElement).not.toBe(input);
    fireEvent.keyDown(window, { key: '/' });
    expect(document.activeElement).toBe(input);
  });

  it('switching to list view renders a table and persists the choice', () => {
    renderWithFiles([mockFile]);
    // Default is grid → no table
    expect(document.querySelector('table')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /list view/i }));
    expect(document.querySelector('table')).not.toBeNull();
    expect(window.localStorage.getItem('octocms:media-view-mode')).toBe('list');
  });

  it('default view mode is restored from localStorage on mount', () => {
    window.localStorage.setItem('octocms:media-view-mode', 'list');
    renderWithFiles([mockFile]);
    expect(document.querySelector('table')).not.toBeNull();
  });

  it('clicking a row in list view also navigates to the asset', () => {
    window.localStorage.setItem('octocms:media-view-mode', 'list');
    renderWithFiles([mockFile]);
    const row = screen.getByText('A test').closest('tr');
    fireEvent.click(row!);
    expect(pushMock).toHaveBeenCalledWith('/cms/media/abc-123');
  });

  it('shows the empty state when no files match', () => {
    renderWithFiles([mockFile]);
    fireEvent.change(screen.getByPlaceholderText(/Filter assets/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/No assets match this search/i)).toBeDefined();
  });
});
