import React from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RecentPullRequestsView } from './RecentPullRequests';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getRecentCMSPullRequestsMock } = vi.hoisted(() => ({
  getRecentCMSPullRequestsMock: vi.fn(),
}));

vi.mock('../../admin/actions/git', () => ({
  getRecentCMSPullRequests: (...args: unknown[]) => getRecentCMSPullRequestsMock(...args),
}));

beforeEach(() => {
  getRecentCMSPullRequestsMock.mockReset();
  getRecentCMSPullRequestsMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

describe('RecentPullRequestsView', () => {
  it('shows the empty state when no PRs are returned', async () => {
    getRecentCMSPullRequestsMock.mockResolvedValue([]);

    renderWithQuery(<RecentPullRequestsView />);

    await waitFor(() => expect(screen.getByText('No CMS pull requests yet')).toBeDefined());
    expect(screen.getAllByText('Recent pull requests').length).toBeGreaterThan(0);
  });

  it('renders a row per PR and varies state badge + CTA copy', async () => {
    getRecentCMSPullRequestsMock.mockResolvedValue([
      {
        branch: 'cms/spring',
        prUrl: 'https://github.com/x/y/pull/1',
        prNumber: 1,
        title: 'Spring 2026 launch',
        state: 'open',
        updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        authorLogin: 'janek',
        authorAvatarUrl: null,
      },
      {
        branch: 'cms/blog-tags',
        prUrl: 'https://github.com/x/y/pull/2',
        prNumber: 2,
        title: 'Fix blog tag slugs',
        state: 'merged',
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        authorLogin: 'amota',
        authorAvatarUrl: null,
      },
      {
        branch: 'cms/scrap',
        prUrl: 'https://github.com/x/y/pull/3',
        prNumber: 3,
        title: 'Abandoned experiment',
        state: 'closed',
        updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        authorLogin: 'rsato',
        authorAvatarUrl: null,
      },
    ]);

    renderWithQuery(<RecentPullRequestsView />);

    await waitFor(() => expect(screen.getByText('Spring 2026 launch')).toBeDefined());
    expect(screen.getByText('Fix blog tag slugs')).toBeDefined();
    expect(screen.getByText('Abandoned experiment')).toBeDefined();
    expect(screen.getByText('Open')).toBeDefined();
    expect(screen.getByText('Merged')).toBeDefined();
    expect(screen.getByText('Closed')).toBeDefined();
    // Open PR uses "Review" CTA, merged/closed use "View".
    expect(screen.getAllByText('Review').length).toBe(1);
    expect(screen.getAllByText('View').length).toBe(2);
  });
});
