import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryListItem } from '../../types';

const { mockGetEntryBacklinks, getRefreshTick, setRefreshTick } = vi.hoisted(() => {
  let tick = 0;
  return {
    mockGetEntryBacklinks: vi.fn<(key: string) => Promise<EntryListItem[]>>(),
    getRefreshTick: () => tick,
    setRefreshTick: (n: number) => {
      tick = n;
    },
  };
});

vi.mock('../../admin/actions', () => ({
  getEntryBacklinks: mockGetEntryBacklinks,
}));

vi.mock('../../hooks/useEntryStack', () => ({
  useEntryStack: () => ({
    stack: [],
    pushEntry: () => {},
    popEntry: () => {},
    closeAll: () => {},
    ancestorPaths: new Set<string>(),
    refreshTick: getRefreshTick(),
    bumpRefresh: () => {},
  }),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    contentFolder: 'cms/content',
    collections: {
      post: { label: 'Post', hasMany: true, fields: { title: { label: 'Title', format: 'string', entryTitle: true } } },
    },
  }),
}));

const initialBacklinks: EntryListItem[] = [
  { type: 'post', id: 'p1', path: 'cms/content/post/post-p1.json', title: 'First Post', status: 'merged' },
];

beforeEach(() => {
  mockGetEntryBacklinks.mockReset();
  setRefreshTick(0);
});

afterEach(() => {
  cleanup();
});

const loadComponent = async () => (await import('./LinkedBySection')).default;

describe('LinkedBySection', () => {
  it('does not register cms:entry-saved or cms:entry-deleted window listeners', async () => {
    mockGetEntryBacklinks.mockResolvedValue([]);
    const addSpy = vi.spyOn(window, 'addEventListener');
    const LinkedBySection = await loadComponent();

    render(<LinkedBySection entryPath="cms/content/post/post-abc.json" />);
    await waitFor(() => expect(mockGetEntryBacklinks).toHaveBeenCalled());

    const types = addSpy.mock.calls.map(([t]) => t);
    expect(types).not.toContain('cms:entry-saved');
    expect(types).not.toContain('cms:entry-deleted');
    addSpy.mockRestore();
  });

  it('refetches when refreshTick bumps after the first load', async () => {
    mockGetEntryBacklinks.mockResolvedValue(initialBacklinks);
    const LinkedBySection = await loadComponent();

    const { rerender } = render(<LinkedBySection entryPath="cms/content/post/post-abc.json" />);
    await waitFor(() => expect(screen.getByText('First Post')).toBeTruthy());
    expect(mockGetEntryBacklinks).toHaveBeenCalledTimes(1);

    mockGetEntryBacklinks.mockResolvedValue([
      { type: 'post', id: 'p1', path: 'cms/content/post/post-p1.json', title: 'First Post', status: 'merged' },
      { type: 'post', id: 'p2', path: 'cms/content/post/post-p2.json', title: 'Second Post', status: 'merged' },
    ]);

    setRefreshTick(1);
    await act(async () => {
      rerender(<LinkedBySection entryPath="cms/content/post/post-abc.json" />);
    });

    await waitFor(() => {
      expect(mockGetEntryBacklinks).toHaveBeenCalledTimes(2);
      expect(screen.getByText('Second Post')).toBeTruthy();
    });
  });
});
