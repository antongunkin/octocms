import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MediaUploadBar } from './MediaUploadBar';

afterEach(cleanup);

describe('MediaUploadBar', () => {
  it('lists allowed formats in the hint', () => {
    render(<MediaUploadBar allowedFormats={['png', 'jpg', 'webp']} onFiles={() => {}} />);
    expect(screen.getByText('PNG, JPG, WEBP')).toBeDefined();
  });

  it('falls back to "any" when there are no allowed formats', () => {
    render(<MediaUploadBar allowedFormats={[]} onFiles={() => {}} />);
    expect(screen.getByText('any')).toBeDefined();
  });

  it('clicking the dropzone opens the hidden file input', () => {
    const onFiles = vi.fn();
    render(<MediaUploadBar allowedFormats={['png']} onFiles={onFiles} />);

    const dropzone = screen.getByRole('button');
    // jsdom's click on <input type="file"> doesn't open a real picker, but we can
    // assert the click was forwarded by spying on `click` on the underlying input.
    const input = dropzone.parentElement!.querySelector('input[type=file]') as HTMLInputElement;
    const inputClick = vi.spyOn(input, 'click');

    fireEvent.click(dropzone);
    expect(inputClick).toHaveBeenCalled();
  });

  it('toggles drag-over visual class when dragging over the strip', () => {
    render(<MediaUploadBar allowedFormats={['png']} onFiles={() => {}} />);
    const dropzone = screen.getByRole('button');

    expect(dropzone.className).toMatch(/border-border/);
    fireEvent.dragOver(dropzone);
    expect(dropzone.className).toMatch(/border-primary/);
    fireEvent.dragLeave(dropzone);
    expect(dropzone.className).toMatch(/border-border/);
  });

  it('forwards dropped files to onFiles', () => {
    const onFiles = vi.fn();
    render(<MediaUploadBar allowedFormats={['png']} onFiles={onFiles} />);
    const dropzone = screen.getByRole('button');

    const file = new File(['x'], 'cat.png', { type: 'image/png' });
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0][0]).toBe(file);
  });

  it('respects the disabled prop', () => {
    render(<MediaUploadBar allowedFormats={['png']} onFiles={() => {}} disabled />);
    const dropzone = screen.getByRole('button') as HTMLButtonElement;
    expect(dropzone.disabled).toBe(true);
  });
});
