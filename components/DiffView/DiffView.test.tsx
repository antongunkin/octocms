import { cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryDiff } from '../../admin/actions/diff';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { mockGetEntryDiff } = vi.hoisted(() => ({
  mockGetEntryDiff: vi.fn<(path: string) => Promise<EntryDiff>>(),
}));

vi.mock('../../admin/actions/diff', () => ({
  getEntryDiff: mockGetEntryDiff,
}));

const mockConfig = {
  collections: {
    post: {
      label: 'Post',
      fields: {
        title: { label: 'Title', format: 'string' },
        body: { label: 'Body', format: 'markdown' },
        hero: { label: 'Hero', format: 'image' },
      },
    },
  },
} as any;

vi.mock('../../hooks/useConfig', () => ({ useConfig: () => mockConfig }));

const loadComponent = async () => (await import('./DiffView')).DiffView;

beforeEach(() => {
  mockGetEntryDiff.mockReset();
});

afterEach(() => cleanup());

const emptyDiff = (overrides: Partial<EntryDiff> = {}): EntryDiff => ({
  changed: false,
  activeBranch: 'cms/edit-1',
  baseBranch: 'main',
  fields: {},
  companions: {},
  imageUrls: {},
  ...overrides,
});

describe('DiffView', () => {
  it('shows a loading skeleton before the diff resolves', async () => {
    mockGetEntryDiff.mockImplementation(() => new Promise(() => {}));
    const DiffView = await loadComponent();

    const { container } = renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);
    // Skeleton: three pulsing placeholder divs.
    expect(container.querySelector('.octo-diff-view__skeleton-line')).toBeTruthy();
  });

  it('shows the empty state when there are no unmerged changes', async () => {
    mockGetEntryDiff.mockResolvedValue(emptyDiff({ changed: false }));
    const DiffView = await loadComponent();

    renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);

    await waitFor(() => expect(screen.getByText(/No unmerged changes for this entry/)).toBeTruthy());
    expect(screen.getByText(/cms\/edit-1/)).toBeTruthy();
    expect(screen.getByText(/main/)).toBeTruthy();
  });

  it('renders an error state when the server action throws', async () => {
    mockGetEntryDiff.mockRejectedValue(new Error('nope'));
    const DiffView = await loadComponent();

    renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);

    await waitFor(() => expect(screen.getByText('Could not load diff.')).toBeTruthy());
  });

  it('renders a row per schema field with format + name when changed', async () => {
    mockGetEntryDiff.mockResolvedValue(
      emptyDiff({
        changed: true,
        fields: {
          title: { kind: 'changed', before: 'Old', after: 'New' },
          hero: { kind: 'unchanged' },
        },
        companions: {
          body: { before: '# old', after: '# new' },
        },
      }),
    );
    const DiffView = await loadComponent();

    renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);

    await waitFor(() => expect(screen.getByText('Title')).toBeTruthy());
    expect(screen.getByText('Body')).toBeTruthy();
    expect(screen.getByText('Hero')).toBeTruthy();
    // Each field header shows its format in a monospace code tag and its machine name.
    expect(screen.getByText('string')).toBeTruthy();
    expect(screen.getByText('markdown')).toBeTruthy();
    expect(screen.getByText('image')).toBeTruthy();
  });

  it('shows "No changes" placeholder for unchanged fields and renders diff for changed ones', async () => {
    mockGetEntryDiff.mockResolvedValue(
      emptyDiff({
        changed: true,
        fields: {
          title: { kind: 'changed', before: 'Old', after: 'New' },
          hero: { kind: 'unchanged' },
        },
        companions: {
          body: { before: '', after: '' },
        },
      }),
    );
    const DiffView = await loadComponent();

    const { container } = renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);

    await waitFor(() => expect(screen.getAllByText('No changes').length).toBeGreaterThanOrEqual(2));
    // The changed title field renders del and add hunk rows.
    expect(container.querySelector('.octo-diff-hunk__line--del')).toBeTruthy();
    expect(container.querySelector('.octo-diff-hunk__line--add')).toBeTruthy();
  });

  it('renders a side-by-side image diff with resolved URLs', async () => {
    mockGetEntryDiff.mockResolvedValue(
      emptyDiff({
        changed: true,
        fields: {
          hero: { kind: 'changed', before: 'uuid-a', after: 'uuid-b' },
        },
        companions: {},
        imageUrls: {
          'uuid-a': '/media/uuid-a.png',
          'uuid-b': '/media/uuid-b.jpg',
        },
      }),
    );
    const DiffView = await loadComponent();

    const { container } = renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);

    await waitFor(() => expect(screen.getByText('Was')).toBeTruthy());
    expect(screen.getByText('Now')).toBeTruthy();
    const imgs = container.querySelectorAll('img');
    const srcs = Array.from(imgs).map((n) => (n as HTMLImageElement).getAttribute('src'));
    expect(srcs).toContain('/media/uuid-a.png');
    expect(srcs).toContain('/media/uuid-b.jpg');
  });

  it('refetches when entryPath changes', async () => {
    mockGetEntryDiff.mockResolvedValue(emptyDiff());
    const DiffView = await loadComponent();

    const { rerender } = renderWithQuery(<DiffView collectionType="post" entryPath="cms/content/post/post-p1.json" />);
    await waitFor(() => expect(mockGetEntryDiff).toHaveBeenCalledWith('cms/content/post/post-p1.json'));

    rerender(<DiffView collectionType="post" entryPath="cms/content/post/post-p2.json" />);
    await waitFor(() => expect(mockGetEntryDiff).toHaveBeenCalledWith('cms/content/post/post-p2.json'));
    expect(mockGetEntryDiff).toHaveBeenCalledTimes(2);
  });
});
