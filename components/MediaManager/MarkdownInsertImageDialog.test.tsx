import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '../../admin/query/test/renderWithQuery';
import { toast } from '../../hooks/useToast';
import { MarkdownInsertImageDialog } from './MarkdownInsertImageDialog';

/**
 * Hoisted mocks. Three signal identities tracked:
 *   - imageDialogState$: read by `useCellValues`, controlled per-test
 *   - saveImage$: published on success — assert payload + identity
 *   - closeImageDialog$: published on cancel — assert it ran
 *
 * `usePublisher` returns a different spy per signal identity so we can tell
 * which one got published. Identity is preserved by `vi.hoisted` symbols.
 */
const {
  imageDialogStateRef,
  saveImageRef,
  closeImageDialogRef,
  imageDialogStateValue,
  publisherSpies,
  resetPublisherSpies,
  baseMediaEntry,
  uploadMediaMock,
  getMediaEntriesMock,
} = vi.hoisted(() => {
  const imageDialogStateRef = Symbol('imageDialogState$');
  const saveImageRef = Symbol('saveImage$');
  const closeImageDialogRef = Symbol('closeImageDialog$');

  type DialogState =
    | { type: 'inactive' }
    | { type: 'new' }
    | { type: 'editing'; nodeKey: string; initialValues: { src: string; altText: string; title?: string } };

  const imageDialogStateValue: { current: DialogState } = {
    current: { type: 'new' },
  };

  const publisherSpies = new Map<symbol, ReturnType<typeof vi.fn>>();
  function resetPublisherSpies() {
    publisherSpies.clear();
    publisherSpies.set(saveImageRef, vi.fn());
    publisherSpies.set(closeImageDialogRef, vi.fn());
  }
  resetPublisherSpies();

  return {
    imageDialogStateRef,
    saveImageRef,
    closeImageDialogRef,
    imageDialogStateValue,
    publisherSpies,
    resetPublisherSpies,
    baseMediaEntry: {
      id: 'existing-1',
      title: 'A library asset',
      originalName: 'existing-1.png',
      extension: 'png',
      folder: '/',
      path: 'public/media/existing-1.png',
      publicUrl: '/media/existing-1.png',
      width: 800 as number | null,
      height: 600 as number | null,
      hasBlurPlaceholder: false,
    },
    uploadMediaMock: vi.fn(),
    getMediaEntriesMock: vi.fn(),
  };
});

vi.mock('@mdxeditor/editor', () => ({
  imageDialogState$: imageDialogStateRef,
  saveImage$: saveImageRef,
  closeImageDialog$: closeImageDialogRef,
}));

vi.mock('@mdxeditor/gurx', () => ({
  useCellValues: (cell: symbol) => {
    if (cell === imageDialogStateRef) return [imageDialogStateValue.current];
    return [undefined];
  },
  usePublisher: (cell: symbol) => {
    const spy = publisherSpies.get(cell);
    if (!spy) {
      const fresh = vi.fn();
      publisherSpies.set(cell, fresh);
      return fresh;
    }
    return spy;
  },
}));

vi.mock('../../admin/actions/media', () => ({
  uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
  getMediaEntries: (...a: unknown[]) => getMediaEntriesMock(...a),
  updateMediaMetadata: vi.fn(),
  moveMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({
  toast: vi.fn(),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    projectName: 'Test',
    contentFolder: 'cms/content',
    mediaContentFolder: 'cms/media',
    mediaFolder: 'public/media',
    mediaAllowedFormats: ['png', 'jpg', 'jpeg', 'gif', 'webp'],
    git: { baseBranch: 'main' },
    collections: {},
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  imageDialogStateValue.current = { type: 'new' };
  resetPublisherSpies();
  uploadMediaMock.mockReset();
  getMediaEntriesMock.mockImplementation(() => Promise.resolve([{ ...baseMediaEntry }]));
  vi.mocked(toast).mockReset();
});

describe('MarkdownInsertImageDialog — new state', () => {
  it('renders nothing when imageDialogState is inactive', () => {
    imageDialogStateValue.current = { type: 'inactive' };
    const { container } = renderWithQuery(<MarkdownInsertImageDialog />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(screen.queryByText('Insert image')).toBeNull();
  });

  it('renders FormImageField (Upload + Select existing buttons) when state is new', () => {
    renderWithQuery(<MarkdownInsertImageDialog />);
    expect(screen.getByText('Insert image')).toBeDefined();
    // FormImageField's labels (note: "Select existing image", not "Select from library")
    expect(screen.getByText('Upload new image')).toBeDefined();
    expect(screen.getByText('Select existing image')).toBeDefined();
  });

  it('publishes closeImageDialog$ (and not saveImage$) when chooser is dismissed', () => {
    renderWithQuery(<MarkdownInsertImageDialog />);

    fireEvent.keyDown(document.body, { key: 'Escape' });

    const closeSpy = publisherSpies.get(closeImageDialogRef)!;
    const saveSpy = publisherSpies.get(saveImageRef)!;
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).not.toHaveBeenCalled();
  });

  it('rejects unsupported formats with a destructive toast (delegated to FormImageField)', async () => {
    renderWithQuery(<MarkdownInsertImageDialog />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [pdf] } });

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({
          title: expect.stringContaining('doc.pdf'),
          variant: 'destructive',
        }),
      );
    });
    expect(screen.queryByText('Set title for each image')).toBeNull();
  });

  it('publishes saveImage$ with /media/<id>.<ext> URL after a single-file upload', async () => {
    uploadMediaMock.mockResolvedValue({ success: true, id: 'new-id-1' });

    renderWithQuery(<MarkdownInsertImageDialog />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const png = new File(['x'], 'sunset.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [png] } });

    await waitFor(() => {
      expect(screen.getByText('Set title for each image')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Upload'));

    const saveSpy = publisherSpies.get(saveImageRef)!;
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
    expect(saveSpy).toHaveBeenCalledWith({
      src: '/media/new-id-1.png',
      altText: 'sunset',
      title: '',
    });
  });

  it('publishes saveImage$ once per file when multiple files upload (preserves order)', async () => {
    uploadMediaMock.mockResolvedValueOnce({ success: true, id: 'a' });
    uploadMediaMock.mockResolvedValueOnce({ success: true, id: 'b' });
    uploadMediaMock.mockResolvedValueOnce({ success: true, id: 'c' });

    renderWithQuery(<MarkdownInsertImageDialog />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['1'], 'one.jpg', { type: 'image/jpeg' }),
      new File(['2'], 'two.png', { type: 'image/png' }),
      new File(['3'], 'three.webp', { type: 'image/webp' }),
    ];
    fireEvent.change(fileInput, { target: { files } });

    await waitFor(() => {
      expect(screen.getByText('Set title for each image')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Upload'));

    const saveSpy = publisherSpies.get(saveImageRef)!;
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(3);
    });
    expect(saveSpy).toHaveBeenNthCalledWith(1, {
      src: '/media/a.jpg',
      altText: 'one',
      title: '',
    });
    expect(saveSpy).toHaveBeenNthCalledWith(2, {
      src: '/media/b.png',
      altText: 'two',
      title: '',
    });
    expect(saveSpy).toHaveBeenNthCalledWith(3, {
      src: '/media/c.webp',
      altText: 'three',
      title: '',
    });
  });

  it('opens MediaSelectDialog and publishes saveImage$ with publicUrl when an existing asset is picked', async () => {
    renderWithQuery(<MarkdownInsertImageDialog />);

    fireEvent.click(screen.getByText('Select existing image'));

    await waitFor(() => {
      expect(screen.getByText('Select an image')).toBeDefined();
    });

    await waitFor(() => {
      expect(screen.getByText('A library asset')).toBeDefined();
    });
    fireEvent.click(screen.getByText('A library asset'));

    const saveSpy = publisherSpies.get(saveImageRef)!;
    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledTimes(1);
    });
    expect(saveSpy).toHaveBeenCalledWith({
      src: '/media/existing-1.png',
      altText: 'A library asset',
      title: '',
    });
  });
});

describe('MarkdownInsertImageDialog — editing state', () => {
  beforeEach(() => {
    imageDialogStateValue.current = {
      type: 'editing',
      nodeKey: 'lexical-key-1',
      initialValues: { src: '/media/foo.png', altText: 'old alt', title: '' },
    };
  });

  it('renders the alt-text editor seeded with the current alt text', () => {
    renderWithQuery(<MarkdownInsertImageDialog />);
    expect(screen.getByText('Edit image')).toBeDefined();
    const altInput = screen.getByLabelText('Alt text') as HTMLInputElement;
    expect(altInput.value).toBe('old alt');
  });

  it('publishes saveImage$ with the edited alt text and original src on Save', () => {
    renderWithQuery(<MarkdownInsertImageDialog />);

    const altInput = screen.getByLabelText('Alt text') as HTMLInputElement;
    fireEvent.change(altInput, { target: { value: 'new descriptive alt' } });
    fireEvent.click(screen.getByText('Save'));

    const saveSpy = publisherSpies.get(saveImageRef)!;
    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith({
      src: '/media/foo.png',
      altText: 'new descriptive alt',
      title: '',
    });
  });

  it('publishes closeImageDialog$ (and not saveImage$) when Cancel is clicked', () => {
    renderWithQuery(<MarkdownInsertImageDialog />);
    fireEvent.click(screen.getByText('Cancel'));

    const closeSpy = publisherSpies.get(closeImageDialogRef)!;
    const saveSpy = publisherSpies.get(saveImageRef)!;
    expect(closeSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).not.toHaveBeenCalled();
  });
});
