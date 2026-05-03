import { cleanup, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ContentModelList from './ContentModelList';
import { queryKeys } from '../../admin/query/keys';
import { createTestQueryClient, renderWithQuery } from '../../admin/query/test/renderWithQuery';

const { getSchemaMock, getEntryListMock } = vi.hoisted(() => ({
  getSchemaMock: vi.fn(),
  getEntryListMock: vi.fn(),
}));

vi.mock('../../admin/actions/schema', () => ({
  getSchema: (...a: unknown[]) => getSchemaMock(...a),
  saveSchema: vi.fn(),
  previewSchemaChange: vi.fn(),
}));

vi.mock('../../admin/actions/entries', () => ({
  getEntryList: (...a: unknown[]) => getEntryListMock(...a),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const sampleSchema = {
  projectName: 'Test',
  contentFolder: 'cms/content',
  collections: {
    post: { label: 'Post', hasMany: true, fields: { title: { label: 'Title', format: 'string' } } },
    home: { label: 'Home', fields: { hero: { label: 'Hero', format: 'string' } } },
  },
} as any;

beforeEach(() => {
  getSchemaMock.mockReset();
  getEntryListMock.mockReset();
});

afterEach(() => {
  cleanup();
});

describe('ContentModelList', () => {
  it('renders the SchemaTableSkeleton while schema is loading', () => {
    getSchemaMock.mockReturnValue(new Promise(() => {}));
    getEntryListMock.mockResolvedValue([]);
    renderWithQuery(<ContentModelList />);
    expect(screen.getByLabelText('Loading content types')).toBeDefined();
  });

  it('renders rows for each collection once the schema resolves', async () => {
    const client = createTestQueryClient();
    client.setQueryData(queryKeys.schema.current(), sampleSchema);
    client.setQueryData(queryKeys.entries.list(), [
      { type: 'post', id: 'a', path: 'cms/content/post/a.json', title: 'A', status: 'merged' },
    ]);
    renderWithQuery(<ContentModelList />, { client });

    await waitFor(() => expect(screen.queryByLabelText('Loading content types')).toBeNull());
    expect(screen.getByText('Post')).toBeDefined();
    expect(screen.getByText('Home')).toBeDefined();
  });
});
