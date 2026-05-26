import { cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import EditPost from './EditPost';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getEntryListMock, getFileMock, getIsProductionMock, hasActiveBranchMock } = vi.hoisted(() => ({
  getEntryListMock: vi.fn(),
  getFileMock: vi.fn(),
  getIsProductionMock: vi.fn(),
  hasActiveBranchMock: vi.fn(),
}));

vi.mock('../../admin/actions/entries', () => ({
  getEntryList: (...a: unknown[]) => getEntryListMock(...a),
  getEntryBacklinks: vi.fn(),
}));

vi.mock('../../admin/actions/files', () => ({
  getFile: (...a: unknown[]) => getFileMock(...a),
  saveFile: vi.fn(),
  removeFile: vi.fn(),
}));

vi.mock('../../admin/actions/git', () => ({
  getIsProduction: (...a: unknown[]) => getIsProductionMock(...a),
  hasActiveBranch: (...a: unknown[]) => hasActiveBranchMock(...a),
  getEntryCommits: vi.fn(),
  getBranch: vi.fn(),
  listCMSBranches: vi.fn(),
}));

vi.mock('../../admin/actions/status', () => ({
  publishEntry: vi.fn(),
  archiveEntry: vi.fn(),
  restoreEntry: vi.fn(),
}));

vi.mock('../../hooks/useConfig', () => ({
  useConfig: () => ({
    contentFolder: 'cms/content',
    git: { baseBranch: 'main' },
    collections: {
      post: {
        label: 'Post',
        hasMany: true,
        fields: { title: { label: 'Title', format: 'string', entryTitle: true } },
      },
    },
  }),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  usePathname: () => '/cms',
}));

vi.mock('../ui/FormField/FormFields', () => ({
  default: ({ fields }: { fields: Record<string, string> }) => (
    <input name="title" defaultValue={fields?.title ?? ''} data-testid="title-input" />
  ),
}));

vi.mock('../HistorySection/HistorySection', () => ({ default: () => null }));
vi.mock('../LinkedBySection/LinkedBySection', () => ({ default: () => null }));
vi.mock('../DiffView', () => ({ DiffView: () => null }));
vi.mock('../Layout/CreateBranchDialog', () => ({ default: () => null }));
vi.mock('../InlineEntryEditor/InlineEntryEditor', () => ({ default: () => null }));

const filePath = 'cms/content/post/post-a.json';
const entry = { sys: { id: 'post-a', type: 'post', status: 'merged' as const }, fields: { title: 'Hello' } };

beforeEach(() => {
  getEntryListMock.mockReset();
  getFileMock.mockReset();
  getIsProductionMock.mockReset().mockResolvedValue(false);
  hasActiveBranchMock.mockReset().mockResolvedValue(true);
});

afterEach(() => {
  cleanup();
});

describe('EditPost', () => {
  it('renders block-level skeletons while the entry list / entry are loading', () => {
    getEntryListMock.mockReturnValue(new Promise(() => {}));
    renderWithQuery(<EditPost type="post" id="post-a" />);
    expect(screen.getByLabelText('Loading entry fields')).toBeDefined();
  });

  it('shows the entry-not-found state when the id is missing from the list', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.entries.list('post'), []);
    renderWithQuery(<EditPost type="post" id="missing" />, { client });

    await waitFor(() => expect(screen.queryByLabelText('Loading entry fields')).toBeNull());
    expect(screen.getByText('Entry not found.')).toBeDefined();
  });

  it('renders the form once the entry resolves', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.entries.list('post'), [
      { type: 'post', id: 'post-a', path: filePath, title: 'Hello', status: 'merged' as const },
    ]);
    client.setQueryData(queryKeys.entries.detail(filePath), entry);

    renderWithQuery(<EditPost type="post" id="post-a" />, { client });

    await waitFor(() => expect(screen.getByTestId('title-input')).toBeDefined());
    expect(screen.getByText('Hello')).toBeDefined();
  });
});
