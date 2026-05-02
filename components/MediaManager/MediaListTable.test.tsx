import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MediaFile } from '../../types';
import { MediaListTable } from './MediaListTable';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

const mockFile = (overrides: Partial<MediaFile> = {}): MediaFile => ({
  id: 'abc-123',
  title: 'Cover',
  originalName: 'cover.png',
  path: 'public/media/abc-123.png',
  folder: '/',
  publicUrl: '/media/abc-123.png',
  extension: 'png',
  width: 1600,
  height: 900,
  hasBlurPlaceholder: false,
  ...overrides,
});

beforeEach(() => pushMock.mockReset());
afterEach(cleanup);

describe('MediaListTable', () => {
  it('renders the column headers', () => {
    render(<MediaListTable files={[]} />);
    for (const header of ['Title', 'Folder', 'Format', 'Dimensions', 'File name']) {
      expect(screen.getByText(header)).toBeDefined();
    }
  });

  it('renders an empty state when there are no files', () => {
    render(<MediaListTable files={[]} />);
    expect(screen.getByText(/No files in this folder\./i)).toBeDefined();
  });

  it('renders a row per file with thumbnail, folder, format, dimensions and filename', () => {
    const files = [
      mockFile({ id: 'a', title: 'Article cover', folder: 'blog', extension: 'jpg' }),
      mockFile({ id: 'b', title: 'Logo', folder: '/', extension: 'svg', width: 256, height: 256 }),
    ];
    render(<MediaListTable files={files} />);

    expect(screen.getByText('Article cover')).toBeDefined();
    expect(screen.getByText('Logo')).toBeDefined();
    expect(screen.getByText('blog')).toBeDefined();
    expect(screen.getByText('Root')).toBeDefined();
    expect(screen.getByText('JPG')).toBeDefined();
    expect(screen.getByText('SVG')).toBeDefined();
    expect(screen.getByText('1600 × 900')).toBeDefined();
    expect(screen.getByText('256 × 256')).toBeDefined();

    const imgs = document.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('src')).toBe(files[0].publicUrl);
  });

  it('renders an em-dash when dimensions are missing', () => {
    render(<MediaListTable files={[mockFile({ width: null, height: null })]} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('clicking a row navigates to /cms/media/[id]', () => {
    render(<MediaListTable files={[mockFile({ id: 'xyz' })]} />);
    const row = screen.getByText('Cover').closest('tr');
    expect(row).not.toBeNull();
    fireEvent.click(row!);
    expect(pushMock).toHaveBeenCalledWith('/cms/media/xyz');
  });
});
