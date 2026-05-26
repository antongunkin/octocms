import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { queryKeys } from '../../../admin/query/keys';
import { renderWithQuery } from '../../../admin/query/test/renderWithQuery';
import FormReferenceField from './FormReferenceField';
import { fireDragReorder } from '../../test/dndTestUtils';

const { mockPushEntry, getRefreshTick, setRefreshTick } = vi.hoisted(() => {
  let tick = 0;
  return {
    mockPushEntry: vi.fn(),
    getRefreshTick: () => tick,
    setRefreshTick: (n: number) => {
      tick = n;
    },
  };
});

vi.mock('octocms/hooks/useEntryStack', () => ({
  EntryStackProvider: ({ children }: { children: React.ReactNode }) => children,
  useEntryStack: () => ({
    stack: [],
    pushEntry: mockPushEntry,
    popEntry: vi.fn(),
    closeAll: vi.fn(),
    ancestorPaths: new Set<string>(),
    refreshTick: getRefreshTick(),
    bumpRefresh: vi.fn(),
  }),
}));

const mockConfig = {
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        body: { label: 'Body', format: 'markdown' },
      },
    },
    author: {
      label: 'Author',
      hasMany: true,
      fields: {
        name: { label: 'Name', format: 'string', entryTitle: true },
      },
    },
    role: {
      label: 'Role',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
      },
    },
  },
} as any;

vi.mock('../../../hooks/useConfig', () => ({ useConfig: () => mockConfig }));

const getEntryListMock = vi.fn(async (collection?: string) => {
  if (collection === 'post') {
    return [
      {
        type: 'post',
        id: 'p1',
        path: 'cms/content/post/post-p1.json',
        title: 'First Post',
      },
      {
        type: 'post',
        id: 'p2',
        path: 'cms/content/post/post-p2.json',
        title: 'Second Post',
      },
    ];
  }
  if (collection === 'author') {
    return [
      {
        type: 'author',
        id: 'a1',
        path: 'cms/content/author/author-a1.json',
        title: 'Alice',
      },
      {
        type: 'author',
        id: 'a2',
        path: 'cms/content/author/author-a2.json',
        title: 'Bob',
      },
    ];
  }
  return [];
});

vi.mock('../../../admin/actions/entries', () => ({
  getEntryList: (collection?: string) => getEntryListMock(collection),
}));

vi.mock('octocms/admin/actions', () => ({
  getEntryList: (collection?: string) => getEntryListMock(collection),
  newFile: vi.fn(async (type: string) => ({
    success: true as const,
    path: `cms/content/${type}/${type}-new-uuid.json`,
  })),
}));

vi.mock('../../../admin/actions/files', () => ({
  newFile: vi.fn(async (type: string) => ({
    success: true as const,
    path: `cms/content/${type}/${type}-new-uuid.json`,
  })),
}));

vi.mock('../../../hooks/useToast', () => ({
  toast: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getEntryListMock.mockClear();
  mockPushEntry.mockClear();
  setRefreshTick(0);
  cleanup();
});

describe('FormReferenceField', () => {
  it('renders label and empty state', async () => {
    renderWithQuery(<FormReferenceField label="Posts" name="posts" value="[]" />);

    expect(screen.getByText('Posts')).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('No items selected')).toBeDefined();
    });
  });

  it('renders the hidden input with serialized paths', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value={JSON.stringify(['post-p1.json'])}
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      const hiddenInput = document.querySelector('input[type="hidden"][name="posts"]') as HTMLInputElement;
      expect(hiddenInput).toBeDefined();
      const parsed = JSON.parse(hiddenInput.value);
      expect(parsed).toContain('post-p1.json');
    });
  });

  it('loads and displays selected reference items with titles', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value={JSON.stringify(['post-p1.json', 'post-p2.json'])}
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('First Post')).toBeDefined();
      expect(screen.getByText('Second Post')).toBeDefined();
    });
  });

  it('shows Add existing and Create new buttons', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value="[]"
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Add existing')).toBeDefined();
      expect(screen.getByText('Create new')).toBeDefined();
    });
  });

  it('shows required indicator when required=true', async () => {
    renderWithQuery(<FormReferenceField label="Author" name="author" value="[]" required />);

    expect(screen.getByText('*')).toBeDefined();
  });

  it('shows single indicator for cardinality one', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Hero"
        name="hero"
        value=""
        reference={{ collections: ['post'], cardinality: 'one' }}
      />,
    );

    expect(screen.getByText('(single)')).toBeDefined();
  });

  it('shows count indicator for max items', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value="[]"
        reference={{ collections: ['post'], cardinality: 'many', max: 5 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('(0/5)')).toBeDefined();
    });
  });

  it('falls back to legacy collection prop', async () => {
    renderWithQuery(
      <FormReferenceField label="Posts" name="posts" value={JSON.stringify(['post-p1.json'])} collection="post" />,
    );

    await waitFor(() => {
      expect(getEntryListMock).toHaveBeenCalledWith('post');
      expect(screen.getByText('First Post')).toBeDefined();
    });
  });

  it('serializes single cardinality as plain string', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Hero"
        name="hero"
        value="post-p1.json"
        reference={{ collections: ['post'], cardinality: 'one' }}
      />,
    );

    await waitFor(() => {
      const hiddenInput = document.querySelector('input[type="hidden"][name="hero"]') as HTMLInputElement;
      expect(hiddenInput).toBeDefined();
      // Single cardinality: plain reference key, not JSON array
      expect(hiddenInput.value).toBe('post-p1.json');
    });
  });

  it('shows validation error when min items not met', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Authors"
        name="authors"
        value="[]"
        reference={{ collections: ['author'], cardinality: 'many', min: 1 }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('At least 1 item required')).toBeDefined();
    });
  });

  it('opens inline edit by calling pushEntry when the reference title is clicked', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeDefined());

    fireEvent.click(screen.getByText('Alice'));

    expect(mockPushEntry).toHaveBeenCalledWith({
      id: 'a1',
      type: 'author',
      path: 'cms/content/author/author-a1.json',
      title: 'Alice',
    });
  });

  it('opens inline edit when the pencil button is clicked', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(screen.getByTitle('Edit inline')).toBeDefined());

    fireEvent.click(screen.getByTitle('Edit inline'));

    expect(mockPushEntry).toHaveBeenCalledWith({
      id: 'a1',
      type: 'author',
      path: 'cms/content/author/author-a1.json',
      title: 'Alice',
    });
  });

  it('refreshTick bump re-resolves titles for currently-listed items', async () => {
    // First load: Alice. After bump: Alicia.
    getEntryListMock.mockImplementationOnce(async () => [
      { type: 'author', id: 'a1', path: 'cms/content/author/author-a1.json', title: 'Alice', status: 'merged' },
    ]);

    const { rerender, client } = renderWithQuery(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(screen.getByText('Alice')).toBeDefined());

    getEntryListMock.mockImplementationOnce(async () => [
      { type: 'author', id: 'a1', path: 'cms/content/author/author-a1.json', title: 'Alicia', status: 'merged' },
    ]);
    client.removeQueries({ queryKey: queryKeys.entries.list('author') });

    setRefreshTick(1);
    rerender(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alicia')).toBeDefined();
      expect(screen.queryByText('Alice')).toBeNull();
    });
  });

  it('refreshTick bump drops items whose entries no longer exist (deleted)', async () => {
    getEntryListMock.mockImplementationOnce(async () => [
      { type: 'author', id: 'a1', path: 'cms/content/author/author-a1.json', title: 'Alice', status: 'merged' },
      { type: 'author', id: 'a2', path: 'cms/content/author/author-a2.json', title: 'Bob', status: 'merged' },
    ]);

    const { rerender, client } = renderWithQuery(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json', 'author-a2.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Alice')).toBeDefined();
      expect(screen.getByText('Bob')).toBeDefined();
    });

    // After delete: a1 is gone from the listing.
    getEntryListMock.mockImplementationOnce(async () => [
      { type: 'author', id: 'a2', path: 'cms/content/author/author-a2.json', title: 'Bob', status: 'merged' },
    ]);
    client.removeQueries({ queryKey: queryKeys.entries.list('author') });

    setRefreshTick(1);
    rerender(
      <FormReferenceField
        label="Authors"
        name="authors"
        value={JSON.stringify(['author-a1.json', 'author-a2.json'])}
        reference={{ collections: ['author'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => {
      expect(screen.queryByText('Alice')).toBeNull();
      expect(screen.getByText('Bob')).toBeDefined();
    });
  });
});

function referenceItemTitles(): string[] {
  return Array.from(document.querySelectorAll('.octo-ff-reference__item-title')).map((el) => el.textContent ?? '');
}

function referenceItemByTitle(title: string): HTMLElement {
  const item = Array.from(document.querySelectorAll('.octo-ff-reference__item')).find((candidate) =>
    candidate.querySelector('.octo-ff-reference__item-title')?.textContent?.includes(title),
  );
  if (!item) throw new Error(`No reference item titled "${title}"`);
  return item as HTMLElement;
}

describe('FormReferenceField drag-and-drop reorder', () => {
  it('reorders selected items on drop', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value={JSON.stringify(['post-p1.json', 'post-p2.json'])}
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(referenceItemTitles()).toEqual(['First Post', 'Second Post']));

    await fireDragReorder(referenceItemByTitle('First Post'), referenceItemByTitle('Second Post'));

    expect(referenceItemTitles()).toEqual(['Second Post', 'First Post']);
  });

  it('updates the hidden input to match the new item order', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value={JSON.stringify(['post-p1.json', 'post-p2.json'])}
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(referenceItemTitles()).toEqual(['First Post', 'Second Post']));

    await fireDragReorder(referenceItemByTitle('First Post'), referenceItemByTitle('Second Post'));

    const hiddenInput = document.querySelector('input[type="hidden"][name="posts"]') as HTMLInputElement;
    expect(JSON.parse(hiddenInput.value)).toEqual(['post-p2.json', 'post-p1.json']);
  });

  it('does not reorder when dropped onto the same item', async () => {
    renderWithQuery(
      <FormReferenceField
        label="Posts"
        name="posts"
        value={JSON.stringify(['post-p1.json', 'post-p2.json'])}
        reference={{ collections: ['post'], cardinality: 'many' }}
      />,
    );

    await waitFor(() => expect(referenceItemTitles()).toEqual(['First Post', 'Second Post']));

    const item = referenceItemByTitle('First Post');
    await act(async () => {
      fireEvent.dragStart(item);
    });
    await act(async () => {
      fireEvent.drop(item);
    });

    expect(referenceItemTitles()).toEqual(['First Post', 'Second Post']);
  });
});
