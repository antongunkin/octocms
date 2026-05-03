import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSchemaImpactPreview } from './useSchemaImpactPreview';
import { withQuery } from '../test/renderWithQuery';

const previewSchemaChangeMock = vi.fn();

vi.mock('../../actions/schema', () => ({
  previewSchemaChange: (...a: unknown[]) => previewSchemaChangeMock(...a),
}));

beforeEach(() => {
  previewSchemaChangeMock.mockReset();
});

describe('useSchemaImpactPreview', () => {
  it('returns the PreviewSchemaResult directly (no throw on valid: false)', async () => {
    previewSchemaChangeMock.mockResolvedValue({ valid: false, errors: ['bad'], changes: [], impact: [] });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useSchemaImpactPreview(), { wrapper: Wrapper });
    const out = await result.current.mutateAsync({ next: {} as any });

    expect(out.valid).toBe(false);
    expect(out.errors).toEqual(['bad']);
    await waitFor(() => expect(result.current.data).toBeDefined());
  });

  it('forwards next config to previewSchemaChange', async () => {
    previewSchemaChangeMock.mockResolvedValue({ valid: true, errors: [], changes: [], impact: [] });
    const { Wrapper } = withQuery();

    const { result } = renderHook(() => useSchemaImpactPreview(), { wrapper: Wrapper });
    await result.current.mutateAsync({ next: { projectName: 'X' } as any });

    expect(previewSchemaChangeMock).toHaveBeenCalledWith({ projectName: 'X' });
  });
});
