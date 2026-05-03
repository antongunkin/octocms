import { cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentTypeDetail from './ContentTypeDetail';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

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

beforeEach(() => {
  getSchemaMock.mockReset();
  getEntryListMock.mockReset();
  saveSchemaMock.mockReset();
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
});
