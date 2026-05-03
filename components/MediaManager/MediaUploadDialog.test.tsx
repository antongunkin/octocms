import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MediaUploadDialog } from './MediaUploadDialog';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';
import { toast } from '../../hooks/useToast';

const { uploadMediaMock } = vi.hoisted(() => ({ uploadMediaMock: vi.fn() }));

vi.mock('../../admin/actions/media', () => ({
  uploadMedia: (...a: unknown[]) => uploadMediaMock(...a),
  getMediaEntries: vi.fn(),
  updateMediaMetadata: vi.fn(),
  moveMedia: vi.fn(),
  deleteMedia: vi.fn(),
}));

vi.mock('../../hooks/useToast', () => ({
  toast: vi.fn(),
}));

afterEach(cleanup);

beforeEach(() => {
  uploadMediaMock.mockReset();
  vi.mocked(toast).mockReset();
});

const file = (name: string) => new File(['x'], name, { type: 'image/png' });

describe('MediaUploadDialog', () => {
  it('renders nothing when files is null', () => {
    renderWithQuery(<MediaUploadDialog files={null} defaultFolder="/" onComplete={() => {}} onCancel={() => {}} />);
    expect(screen.queryByText('Set title for each image')).toBeNull();
  });

  it('shows one row per staged file with Title input + Generate blur checkbox', async () => {
    renderWithQuery(
      <MediaUploadDialog
        files={[file('first.png'), file('second.png')]}
        defaultFolder="/"
        onComplete={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.getByText('Set title for each image')).toBeDefined();
    expect(screen.getByText('first.png')).toBeDefined();
    expect(screen.getByText('second.png')).toBeDefined();
    expect(screen.getAllByText('Generate blur placeholder')).toHaveLength(2);
    // Title labels (one per file)
    expect(screen.getAllByText('Title')).toHaveLength(2);
  });

  it('rejects empty Title with a destructive toast', async () => {
    renderWithQuery(
      <MediaUploadDialog files={[file('a.png')]} defaultFolder="/" onComplete={() => {}} onCancel={() => {}} />,
    );

    const titleInput = document.getElementById('upload-title-0') as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Each file needs a Title', variant: 'destructive' }),
      );
    });
  });

  it('forwards generateBlur=1 by default and =0 when unchecked', async () => {
    uploadMediaMock.mockResolvedValue({ success: true, id: 'new-id' });
    const onComplete = vi.fn();

    renderWithQuery(
      <MediaUploadDialog
        files={[file('a.png'), file('b.png')]}
        defaultFolder="blog"
        onComplete={onComplete}
        onCancel={() => {}}
      />,
    );

    // Uncheck the second row's blur option.
    const checkboxes = document.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => expect(onComplete).toHaveBeenCalledWith(['new-id', 'new-id']));

    const calls = uploadMediaMock.mock.calls;
    expect(calls).toHaveLength(2);
    expect((calls[0][0] as FormData).get('generateBlur')).toBe('1');
    expect((calls[0][0] as FormData).get('folder')).toBe('blog');
    expect((calls[1][0] as FormData).get('generateBlur')).toBe('0');
  });

  it('halts the batch on first failure and surfaces the error', async () => {
    uploadMediaMock.mockResolvedValue({ success: false, error: 'disk full' });
    const onComplete = vi.fn();

    renderWithQuery(
      <MediaUploadDialog files={[file('a.png')]} defaultFolder="/" onComplete={onComplete} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByText('Upload'));

    await waitFor(() => {
      expect(vi.mocked(toast)).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'disk full', variant: 'destructive' }),
      );
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('calls onCancel when the user clicks Cancel', () => {
    const onCancel = vi.fn();
    renderWithQuery(
      <MediaUploadDialog files={[file('a.png')]} defaultFolder="/" onComplete={() => {}} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});
