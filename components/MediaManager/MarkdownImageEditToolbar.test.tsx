import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MarkdownImageEditToolbar } from './MarkdownImageEditToolbar';

const { editorUpdateSpy, removeSpy, openEditImageDialogSpy, openEditImageDialogRef, parseImageDimensionMock } =
  vi.hoisted(() => {
    const editorUpdateSpy = vi.fn();
    const removeSpy = vi.fn();
    const openEditImageDialogSpy = vi.fn();
    const openEditImageDialogRef = Symbol('openEditImageDialog$');
    return {
      editorUpdateSpy,
      removeSpy,
      openEditImageDialogSpy,
      openEditImageDialogRef,
      parseImageDimensionMock: vi.fn((v: unknown) => v),
    };
  });

vi.mock('@mdxeditor/editor', () => ({
  openEditImageDialog$: openEditImageDialogRef,
  parseImageDimension: parseImageDimensionMock,
}));

vi.mock('@mdxeditor/gurx', () => ({
  usePublisher: (cell: symbol) => {
    if (cell === openEditImageDialogRef) return openEditImageDialogSpy;
    return vi.fn();
  },
}));

vi.mock('@lexical/react/LexicalComposerContext', () => ({
  useLexicalComposerContext: () => [
    {
      update: (cb: () => void) => {
        editorUpdateSpy(cb);
        cb();
      },
    },
  ],
}));

vi.mock('lexical', () => ({
  $getNodeByKey: vi.fn(() => ({ remove: removeSpy })),
}));

afterEach(cleanup);

beforeEach(() => {
  editorUpdateSpy.mockReset();
  removeSpy.mockReset();
  openEditImageDialogSpy.mockReset();
});

const baseProps = {
  nodeKey: 'lex-1',
  imageSource: '/media/foo.png',
  initialImagePath: '/media/foo.png',
  title: '',
  alt: 'a photo',
};

describe('MarkdownImageEditToolbar', () => {
  it('renders Delete and Edit buttons', () => {
    render(<MarkdownImageEditToolbar {...baseProps} />);
    expect(screen.getByLabelText('Delete image')).toBeDefined();
    expect(screen.getByLabelText('Edit image')).toBeDefined();
  });

  it('does NOT remove the node on first delete click — opens confirmation dialog instead', () => {
    render(<MarkdownImageEditToolbar {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Delete image'));

    expect(removeSpy).not.toHaveBeenCalled();
    expect(editorUpdateSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Delete this image?')).toBeDefined();
  });

  it('removes the node only after the user confirms in the dialog', () => {
    render(<MarkdownImageEditToolbar {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Delete image'));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(editorUpdateSpy).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledTimes(1);
  });

  it('does not remove the node when Cancel is clicked in the confirmation dialog', () => {
    render(<MarkdownImageEditToolbar {...baseProps} />);

    fireEvent.click(screen.getByLabelText('Delete image'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(removeSpy).not.toHaveBeenCalled();
    expect(editorUpdateSpy).not.toHaveBeenCalled();
  });

  it('publishes openEditImageDialog$ with the current values when Edit is clicked', () => {
    render(<MarkdownImageEditToolbar {...baseProps} width={400} height={300} />);

    fireEvent.click(screen.getByLabelText('Edit image'));

    expect(openEditImageDialogSpy).toHaveBeenCalledTimes(1);
    expect(openEditImageDialogSpy).toHaveBeenCalledWith({
      nodeKey: 'lex-1',
      initialValues: {
        src: '/media/foo.png',
        title: '',
        altText: 'a photo',
        width: 400,
        height: 300,
      },
    });
  });

  it('falls back to imageSource when initialImagePath is null', () => {
    render(<MarkdownImageEditToolbar {...baseProps} initialImagePath={null} imageSource="/media/bar.jpg" />);

    fireEvent.click(screen.getByLabelText('Edit image'));

    expect(openEditImageDialogSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        initialValues: expect.objectContaining({ src: '/media/bar.jpg' }),
      }),
    );
  });
});
