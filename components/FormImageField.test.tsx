import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import * as cmsActions from '../admin/actions';
import { toast } from '../hooks/useToast';
import FormImageField from './FormImageField';

const { baseMediaEntry } = vi.hoisted(() => ({
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
}));

vi.mock('octocms/admin/actions', () => ({
  getMediaEntries: vi.fn(() => Promise.resolve([{ ...baseMediaEntry }])),
  uploadMedia: vi.fn(),
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
  vi.mocked(cmsActions.uploadMedia).mockReset();
  vi.mocked(cmsActions.getMediaEntries).mockImplementation(() => Promise.resolve([{ ...baseMediaEntry }]));
});

describe('FormImageField', () => {
  it('renders label + both action buttons when no value', () => {
    render(<FormImageField label="Cover Image" name="coverImage" value="" />);

    expect(screen.getByText('Cover Image')).toBeDefined();
    expect(screen.getByText('Upload new image')).toBeDefined();
    expect(screen.getByText('Select existing image')).toBeDefined();
  });

  it('keeps both action buttons visible when a value is already set', async () => {
    render(<FormImageField label="Cover" name="cover" value="uuid-123" />);

    // No more "Change image" — the two action buttons are always present.
    expect(screen.queryByText('Change image')).toBeNull();
    expect(screen.getByText('Upload new image')).toBeDefined();
    expect(screen.getByText('Select existing image')).toBeDefined();
  });

  it('renders hidden input with the UUID value', () => {
    const { container } = render(<FormImageField label="Cover" name="coverImage" value="uuid-123" />);

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden).toBeDefined();
    expect(hidden.name).toBe('coverImage');
    expect(hidden.value).toBe('uuid-123');
  });

  it('renders hidden input with empty value when no image selected', () => {
    const { container } = render(<FormImageField label="Cover" name="coverImage" value="" />);

    const hidden = container.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.value).toBe('');
  });

  it('rejects unsupported formats with a destructive toast', async () => {
    render(<FormImageField label="Cover" name="coverImage" value="" />);

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
    vi.mocked(cmsActions.uploadMedia).mockResolvedValue({
      success: false,
      error: 'upload failed',
    });

    render(<FormImageField label="Cover" name="coverImage" value="" />);

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
    vi.mocked(cmsActions.uploadMedia).mockResolvedValue({
      success: true,
      id: 'new-media-id',
    });
    vi.mocked(cmsActions.getMediaEntries).mockImplementation(() =>
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

    render(<FormImageField label="Cover" name="coverImage" value="" />);

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
    render(<FormImageField label="Cover" name="coverImage" value="" />);

    fireEvent.click(screen.getByText('Select existing image'));

    expect(screen.getByText('Select an image')).toBeDefined();
  });
});
