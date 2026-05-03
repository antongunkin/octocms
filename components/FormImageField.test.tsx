import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '../admin/query/test/renderWithQuery';
import { toast } from '../hooks/useToast';
import FormImageField from './FormImageField';

const { baseMediaEntry, getMediaEntriesMock, uploadMediaMock } = vi.hoisted(() => ({
  baseMediaEntry: {
    id: 'uuid-123',
    title: 'Existing photo',
    originalName: 'photo.png',
    extension: 'png',
    folder: '/',
    path: 'public/media/uuid-123.png',
    publicUrl: '/media/uuid-123.png',
    width: null as number | null,
    height: null as number | null,
    hasBlurPlaceholder: false,
  },
  getMediaEntriesMock: vi.fn(),
  uploadMediaMock: vi.fn(),
}));

vi.mock('octocms/admin/actions', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
  uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
}));

// Hooks import directly from the action file rather than the barrel.
vi.mock('../admin/actions/media', () => ({
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
  uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
  updateMediaMetadata: vi.fn(),
  moveMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));

vi.mock('../hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('../hooks/useConfig', () => ({
  useConfig: () => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'ico'],
    git: { baseBranch: 'main' },
    collections: {},
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  uploadMediaMock.mockReset();
  getMediaEntriesMock.mockImplementation(() => Promise.resolve([{ ...baseMediaEntry }]));
});

describe('FormImageField', () => {
  it('renders label + both action buttons when no value', () => {
    renderWithQuery(<FormImageField label="Cover Image" name="coverImage" value="" />);

    expect(screen.getByText('Cover Image')).toBeDefined();
    expect(screen.getByText('Upload new image')).toBeDefined();
    expect(screen.getByText('Select existing image')).toBeDefined();
  });

  it('keeps both action buttons visible when a value is already set', async () => {
    renderWithQuery(<FormImageField label="Cover" name="cover" value="uuid-123" />);

    // No more "Change image" — the two action buttons are always present.
    expect(screen.queryByText('Change image')).toBeNull();
    expect(screen.getByText('Upload new image')).toBeDefined();
    expect(screen.getByText('Select existing image')).toBeDefined();
  });

  it('renders hidden input with the UUID value', () => {
    const { container } = renderWithQuery(<FormImageField label="Cover" name="coverImage" value="uuid-123" />);

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden).toBeDefined();
    expect(hidden.name).toBe('coverImage');
    expect(hidden.value).toBe('uuid-123');
  });

  it('renders hidden input with empty value when no image selected', () => {
    const { container } = renderWithQuery(<FormImageField label="Cover" name="coverImage" value="" />);

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('');
  });

  it('rejects unsupported formats with a destructive toast', async () => {
    renderWithQuery(<FormImageField label="Cover" name="coverImage" value="" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'document.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('document.pdf'),
          variant: 'destructive',
        }),
      );
    });
  });

  it('shows destructive toast when uploadMedia fails', async () => {
    uploadMediaMock.mockResolvedValue({
      success: false,
      error: 'upload failed',
    });

    renderWithQuery(<FormImageField label="Cover" name="coverImage" value="" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // The MediaUploadDialog opens with a "Upload" button in its footer.
    await waitFor(() => {
      expect(screen.getByText('Set title for each image')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'upload failed',
          variant: 'destructive',
        }),
      );
    });
  });

  it('shows success toast when uploadMedia succeeds', async () => {
    uploadMediaMock.mockResolvedValue({
      success: true,
      id: 'new-media-id',
    });
    getMediaEntriesMock.mockImplementation(() =>
      Promise.resolve([
        baseMediaEntry,
        {
          id: 'new-media-id',
          title: 'hero',
          originalName: 'new-media-id.png',
          extension: 'png',
          folder: '/',
          path: 'public/media/new-media-id.png',
          publicUrl: '/media/new-media-id.png',
          width: null,
          height: null,
          hasBlurPlaceholder: false,
        },
      ]),
    );

    renderWithQuery(<FormImageField label="Cover" name="coverImage" value="" />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['x'], 'hero.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Set title for each image')).toBeDefined();
    });
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('Uploaded'),
          variant: 'success',
        }),
      );
    });
  });

  it('opens the MediaSelectDialog when "Select existing image" is clicked', () => {
    renderWithQuery(<FormImageField label="Cover" name="coverImage" value="" />);

    fireEvent.click(screen.getByText('Select existing image'));

    expect(screen.getByText('Select an image')).toBeDefined();
  });
});
