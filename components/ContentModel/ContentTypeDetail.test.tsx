import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentTypeDetail from './ContentTypeDetail';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';
import { fireDragReorder } from '../test/dndTestUtils';
import { toast } from '../../hooks/useToast';

const { getSchemaMock, getEntryListMock, saveSchemaMock } = vi.hoisted(() => ({
  getSchemaMock: vi.fn(),
  getEntryListMock: vi.fn(),
  saveSchemaMock: vi.fn(),
}));

vi.mock('../../admin/actions/schema', () => ({
  getSchema: (...a: unknown[]) => getSchemaMock(...a),
  saveSchema: (...a: unknown[]) => saveSchemaMock(...a),
  previewSchemaChange: vi.fn(),
}));

vi.mock('../../admin/actions/entries', () => ({
  getEntryList: (...a: unknown[]) => getEntryListMock(...a),
}));

vi.mock('../../hooks/useToast', () => ({ toast: vi.fn() }));

const toastMock = vi.mocked(toast);

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const sampleSchema = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        slug: { label: 'Slug', format: 'slug' },
      },
    },
  },
} as any;

const multiFieldSchema = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  collections: {
    post: {
      label: 'Post',
      hasMany: true,
      fields: {
        title: { label: 'Title', format: 'string', entryTitle: true },
        slug: { label: 'Slug', format: 'slug' },
        body: { label: 'Body', format: 'markdown' },
      },
    },
  },
} as any;

function fieldRowKeys(): string[] {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('.octo-table-cell--mono')?.textContent ?? '')
    .filter(Boolean);
}

function fieldRow(key: string): HTMLElement {
  const row = screen
    .getAllByRole('row')
    .slice(1)
    .find((candidate) => candidate.querySelector('.octo-table-cell--mono')?.textContent === key);
  if (!row) throw new Error(`No field row for key "${key}"`);
  return row as HTMLElement;
}

async function renderPostDetail(client = createTestQueryClient(), schema = multiFieldSchema) {
  client.setQueryData(queryKeys.schema.current(), schema);
  client.setQueryData(queryKeys.entries.list('post'), []);
  renderWithQuery(<ContentTypeDetail type="post" />, { client });
  await waitFor(() => expect(screen.queryByLabelText('Loading fields')).toBeNull());
  return client;
}

beforeEach(() => {
  getSchemaMock.mockReset();
  getEntryListMock.mockReset();
  saveSchemaMock.mockReset();
  toastMock.mockReset();
  saveSchemaMock.mockResolvedValue({ success: true });
});

afterEach(() => {
  cleanup();
});

describe('ContentTypeDetail', () => {
  it('renders FieldTableSkeleton while schema is loading', () => {
    getSchemaMock.mockReturnValue(new Promise(() => {}));
    getEntryListMock.mockResolvedValue([]);
    renderWithQuery(<ContentTypeDetail type="post" />);
    expect(screen.getByLabelText('Loading fields')).toBeDefined();
  });

  it('shows the not-found state when the type is missing from schema', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.schema.current(), sampleSchema);
    client.setQueryData(queryKeys.entries.list('missing'), []);
    renderWithQuery(<ContentTypeDetail type="missing" />, { client });

    await waitFor(() => expect(screen.queryByLabelText('Loading fields')).toBeNull());
    expect(screen.getByText('Content type not found')).toBeDefined();
  });

  it('renders the field table when the schema and type resolve', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.schema.current(), sampleSchema);
    client.setQueryData(queryKeys.entries.list('post'), []);
    renderWithQuery(<ContentTypeDetail type="post" />, { client });

    await waitFor(() => expect(screen.queryByLabelText('Loading fields')).toBeNull());
    // Header label and the field keys appear in the rendered detail.
    expect(screen.getAllByText('Post').length).toBeGreaterThan(0);
    expect(screen.getAllByText('title').length).toBeGreaterThan(0);
    expect(screen.getAllByText('slug').length).toBeGreaterThan(0);
  });

  describe('field drag-and-drop reorder', () => {
    it('updates row order immediately on drop, before saveSchema resolves', async () => {
      saveSchemaMock.mockImplementation(() => new Promise(() => {}));
      await renderPostDetail();

      expect(fieldRowKeys()).toEqual(['title', 'slug', 'body']);

      await fireDragReorder(fieldRow('title'), fieldRow('body'));

      expect(fieldRowKeys()).toEqual(['slug', 'body', 'title']);
    });

    it('calls saveSchema with fields in the new key order', async () => {
      await renderPostDetail();

      await fireDragReorder(fieldRow('title'), fieldRow('body'));

      await waitFor(() => expect(saveSchemaMock).toHaveBeenCalledTimes(1));
      const saved = saveSchemaMock.mock.calls[0]![0] as typeof multiFieldSchema;
      expect(Object.keys(saved.collections.post.fields)).toEqual(['slug', 'body', 'title']);
      expect(saveSchemaMock.mock.calls[0]![1]).toEqual({ message: 'CMS: reorder fields on post' });
    });

    it('restores the prior row order when saveSchema fails', async () => {
      saveSchemaMock.mockResolvedValue({ success: false, error: 'Save failed' });
      await renderPostDetail();

      await fireDragReorder(fieldRow('slug'), fieldRow('title'));

      await waitFor(() => expect(saveSchemaMock).toHaveBeenCalled());
      await waitFor(() => expect(fieldRowKeys()).toEqual(['title', 'slug', 'body']));
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: "Couldn't save", variant: 'destructive' }),
      );
    });

    it('ignores a drop onto the same row', async () => {
      await renderPostDetail();

      await act(async () => {
        fireEvent.dragStart(fieldRow('slug'));
      });
      await act(async () => {
        fireEvent.drop(fieldRow('slug'));
      });

      expect(fieldRowKeys()).toEqual(['title', 'slug', 'body']);
      expect(saveSchemaMock).not.toHaveBeenCalled();
    });

    it('keeps the optimistic order when the schema cache still has the old key order', async () => {
      saveSchemaMock.mockImplementation(() => new Promise(() => {}));
      const client = await renderPostDetail();

      await fireDragReorder(fieldRow('body'), fieldRow('title'));
      expect(fieldRowKeys()).toEqual(['body', 'title', 'slug']);

      // TanStack Query often keeps the old `fields` object reference for reorder-only saves.
      client.setQueryData(queryKeys.schema.current(), multiFieldSchema);

      await waitFor(() => expect(fieldRowKeys()).toEqual(['body', 'title', 'slug']));
    });

    it('drops the optimistic override once the schema cache matches the new order', async () => {
      const client = await renderPostDetail();

      await fireDragReorder(fieldRow('slug'), fieldRow('body'));
      await waitFor(() => expect(saveSchemaMock).toHaveBeenCalled());
      expect(fieldRowKeys()).toEqual(['title', 'body', 'slug']);

      client.setQueryData(queryKeys.schema.current(), {
        ...multiFieldSchema,
        collections: {
          post: {
            ...multiFieldSchema.collections.post,
            fields: {
              title: multiFieldSchema.collections.post.fields.title,
              body: multiFieldSchema.collections.post.fields.body,
              slug: multiFieldSchema.collections.post.fields.slug,
            },
          },
        },
      });

      await waitFor(() => expect(fieldRowKeys()).toEqual(['title', 'body', 'slug']));
    });
  });
});
