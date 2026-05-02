import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CreateFolderDialog, sanitizeFolderName } from './CreateFolderDialog';

afterEach(cleanup);

describe('sanitizeFolderName', () => {
  it('replaces disallowed characters with -', () => {
    expect(sanitizeFolderName('hello world!')).toBe('hello-world-');
  });

  it('keeps letters, digits, dashes, underscores', () => {
    expect(sanitizeFolderName('blog_posts-2024')).toBe('blog_posts-2024');
  });

  it('trims surrounding whitespace before sanitising', () => {
    expect(sanitizeFolderName('   posts   ')).toBe('posts');
  });
});

describe('CreateFolderDialog', () => {
  it('calls onCreate with sanitized name and closes', () => {
    const onCreate = vi.fn();
    const onOpenChange = vi.fn();
    render(<CreateFolderDialog open existing={[]} onCreate={onCreate} onOpenChange={onOpenChange} />);

    const input = screen.getByPlaceholderText(/blog-posts/);
    fireEvent.change(input, { target: { value: 'My Folder!' } });
    fireEvent.click(screen.getByRole('button', { name: /create folder/i }));

    expect(onCreate).toHaveBeenCalledWith('My-Folder-');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('blocks duplicate names', () => {
    const onCreate = vi.fn();
    render(
      <CreateFolderDialog open existing={['blog']} onCreate={onCreate} onOpenChange={vi.fn()} />,
    );

    fireEvent.change(screen.getByPlaceholderText(/blog-posts/), { target: { value: 'blog' } });
    fireEvent.click(screen.getByRole('button', { name: /create folder/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/already exists/i)).toBeDefined();
  });

  it('blocks empty names', () => {
    const onCreate = vi.fn();
    render(<CreateFolderDialog open existing={[]} onCreate={onCreate} onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /create folder/i }));

    expect(onCreate).not.toHaveBeenCalled();
    expect(screen.getByText(/required/i)).toBeDefined();
  });
});
