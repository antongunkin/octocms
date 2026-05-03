import { act, cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EntryCommit } from '../../types';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { mockGetEntryCommits, getRefreshTick, setRefreshTick } = vi.hoisted(() => {
  let tick = 0;
  return {
    mockGetEntryCommits: vi.fn<(path: string) => Promise<{ commits: EntryCommit[]; seeAllUrl: string }>>(),
    getRefreshTick: () => tick,
    setRefreshTick: (n: number) => {
      tick = n;
    },
  };
});

vi.mock('../../admin/actions/git', () => ({
  getEntryCommits: mockGetEntryCommits,
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

type IOCallback = (entries: IntersectionObserverEntry[]) => void;

let ioInstances: Array<{ cb: IOCallback; node: Element }>;
class MockIntersectionObserver {
  cb: IOCallback;
  constructor(cb: IOCallback) {
    this.cb = cb;
  }
  observe(node: Element) {
    ioInstances.push({ cb: this.cb, node });
  }
  disconnect() {}
  takeRecords() {
    return [];
  }
  unobserve() {}
  root = null;
  rootMargin = '';
  thresholds = [];
}

const triggerIntersect = () => {
  for (const instance of ioInstances) {
    instance.cb([{ isIntersecting: true, target: instance.node } as unknown as IntersectionObserverEntry]);
  }
};

const sampleCommits: EntryCommit[] = [
  {
    sha: '1111111abcdef',
    shortSha: '1111111',
    message: 'Update body',
    author: { login: 'ada', name: 'Ada Lovelace', avatarUrl: null },
    committedAt: new Date(Date.now() - 60_000).toISOString(),
    url: 'https://github.com/acme/site/commit/1111111abcdef',
  },
  {
    sha: '2222222abcdef',
    shortSha: '2222222',
    message: 'Initial draft',
    author: { login: null, name: 'Grace Hopper', avatarUrl: null },
    committedAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    url: 'https://github.com/acme/site/commit/2222222abcdef',
  },
];

beforeEach(() => {
  ioInstances = [];
  vi.stubGlobal('IntersectionObserver', MockIntersectionObserver as unknown as typeof IntersectionObserver);
  mockGetEntryCommits.mockReset();
  setRefreshTick(0);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const loadComponent = async () => (await import('./HistorySection')).default;

describe('HistorySection', () => {
  it('renders the skeleton on mount and does not call getEntryCommits before intersection', async () => {
    mockGetEntryCommits.mockResolvedValue({ commits: sampleCommits, seeAllUrl: 'https://x/commits' });
    const HistorySection = await loadComponent();

    renderWithQuery(<HistorySection entryPath="cms/content/post/post-abc.json" />);

    expect(screen.getByTestId('history-skeleton')).toBeTruthy();
    expect(mockGetEntryCommits).not.toHaveBeenCalled();
  });

  it('fetches and renders commit rows after intersection', async () => {
    mockGetEntryCommits.mockResolvedValue({
      commits: sampleCommits,
      seeAllUrl: 'https://github.com/acme/site/commits/main/cms/content/post/post-abc.json',
    });
    const HistorySection = await loadComponent();

    renderWithQuery(<HistorySection entryPath="cms/content/post/post-abc.json" />);
    await act(async () => {
      triggerIntersect();
    });

    await waitFor(() => expect(mockGetEntryCommits).toHaveBeenCalledTimes(1));

    const firstLink = screen.getByRole('link', { name: /Update body/ }) as HTMLAnchorElement;
    expect(firstLink.href).toBe('https://github.com/acme/site/commit/1111111abcdef');
    expect(firstLink.target).toBe('_blank');

    expect(screen.getByText(/Ada Lovelace/)).toBeTruthy();
    expect(screen.getByText(/1111111/)).toBeTruthy();

    const seeAll = screen.getByRole('link', { name: /See all commits/ }) as HTMLAnchorElement;
    expect(seeAll.href).toBe('https://github.com/acme/site/commits/main/cms/content/post/post-abc.json');
  });

  it('renders empty message when no commits are returned', async () => {
    mockGetEntryCommits.mockResolvedValue({ commits: [], seeAllUrl: '' });
    const HistorySection = await loadComponent();

    renderWithQuery(<HistorySection entryPath="cms/content/post/post-abc.json" />);
    await act(async () => {
      triggerIntersect();
    });

    await waitFor(() => expect(screen.getByText('No commits yet.')).toBeTruthy());
    expect(screen.queryByRole('link', { name: /See all commits/ })).toBeNull();
  });

  it('refetches when refreshTick bumps after intersection, and does not fetch before intersection', async () => {
    mockGetEntryCommits.mockResolvedValue({ commits: sampleCommits, seeAllUrl: '' });
    const HistorySection = await loadComponent();

    const { rerender } = renderWithQuery(<HistorySection entryPath="cms/content/post/post-abc.json" />);

    setRefreshTick(1);
    rerender(<HistorySection entryPath="cms/content/post/post-abc.json" />);
    expect(mockGetEntryCommits).not.toHaveBeenCalled();

    await act(async () => {
      triggerIntersect();
    });
    await waitFor(() => expect(mockGetEntryCommits).toHaveBeenCalledTimes(1));

    setRefreshTick(2);
    rerender(<HistorySection entryPath="cms/content/post/post-abc.json" />);
    await waitFor(() => expect(mockGetEntryCommits).toHaveBeenCalledTimes(2));
  });
});
