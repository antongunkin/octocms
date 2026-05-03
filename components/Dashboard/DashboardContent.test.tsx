import React from 'react';
import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DashboardContent from './DashboardContent';
import { renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getEntryListMock, getBranchMock, hasActiveBranchMock, mockConfig } = vi.hoisted(() => ({
  getEntryListMock: vi.fn(),
  getBranchMock: vi.fn(),
  hasActiveBranchMock: vi.fn(),
  mockConfig: {
    contentFolder: 'cms/content',
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: { title: { label: 'Title', format: 'string', entryTitle: true } },
      },
    },
  } as any,
}));

vi.mock('../../admin/actions/entries', () => ({
  getEntryList: (...args: unknown[]) => getEntryListMock(...args),
}));

vi.mock('../../admin/actions/git', () => ({
  getBranch: (...args: unknown[]) => getBranchMock(...args),
  hasActiveBranch: (...args: unknown[]) => hasActiveBranchMock(...args),
}));

vi.mock('../../admin/actions/files', () => ({
  newFile: vi.fn(),
}));

vi.mock('../../hooks/useConfig', () => ({ useConfig: () => mockConfig }));
vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

beforeEach(() => {
  getEntryListMock.mockReset();
  getBranchMock.mockResolvedValue('main');
  hasActiveBranchMock.mockResolvedValue(false);
});

afterEach(() => {
  cleanup();
});

describe('DashboardContent', () => {
  it('renders block-level skeletons while entries are loading', () => {
    // Never-resolving promise → query stays in pending state.
    getEntryListMock.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<DashboardContent />);

    expect(screen.getByLabelText('Loading collections')).toBeDefined();
    expect(screen.getByLabelText('Loading entries')).toBeDefined();
    expect(screen.getByLabelText('Loading entry count')).toBeDefined();
  });

  it('renders the real left panel and table after entries resolve', async () => {
    getEntryListMock.mockResolvedValue([
      {
        type: 'post',
        id: 'a',
        path: 'cms/content/post/a.json',
        title: 'Hello World',
        status: 'merged',
      },
    ]);

    renderWithQuery(<DashboardContent />);

    await waitFor(() => {
      expect(screen.getByText('Hello World')).toBeDefined();
    });
    expect(screen.queryByLabelText('Loading collections')).toBeNull();
    expect(screen.queryByLabelText('Loading entries')).toBeNull();
    expect(screen.queryByLabelText('Loading entry count')).toBeNull();
  });
});
