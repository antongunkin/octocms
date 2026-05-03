import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { invalidateAfterMutation } from './invalidate';
import { queryKeys } from './keys';

let qc: QueryClient;
let invalidateSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  qc = new QueryClient();
  invalidateSpy = vi.fn();
  // Spy via prototype so all invalidateQueries calls are tracked.
  qc.invalidateQueries = invalidateSpy as unknown as QueryClient['invalidateQueries'];
});

function calls() {
  return invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
}

describe('invalidateAfterMutation', () => {
  it('entries → invalidates only entries', () => {
    invalidateAfterMutation(qc, ['entries']);
    expect(calls()).toEqual([queryKeys.entries.all]);
  });

  it('media → invalidates only media', () => {
    invalidateAfterMutation(qc, ['media']);
    expect(calls()).toEqual([queryKeys.media.all]);
  });

  it('agent → invalidates only agent', () => {
    invalidateAfterMutation(qc, ['agent']);
    expect(calls()).toEqual([queryKeys.agent.all]);
  });

  it('schema → invalidates schema AND entries (field renames bubble through)', () => {
    invalidateAfterMutation(qc, ['schema']);
    expect(calls()).toEqual([queryKeys.schema.all, queryKeys.entries.all]);
  });

  it('git → invalidates git AND entries (branch flip changes content)', () => {
    invalidateAfterMutation(qc, ['git']);
    expect(calls()).toEqual([queryKeys.git.all, queryKeys.entries.all]);
  });

  it('dedupes shared keys across multiple domains', () => {
    // Both 'schema' and 'git' fan out to ['entries'] — invalidate once, not twice.
    invalidateAfterMutation(qc, ['schema', 'git']);
    const fingerprints = calls().map((k) => JSON.stringify(k));
    const uniqueCount = new Set(fingerprints).size;
    expect(fingerprints.length).toBe(uniqueCount);
    // schema (×2) + git (×1 unique, since entries was already counted) = 3
    expect(fingerprints).toEqual([
      JSON.stringify(queryKeys.schema.all),
      JSON.stringify(queryKeys.entries.all),
      JSON.stringify(queryKeys.git.all),
    ]);
  });

  it('empty domain list is a no-op', () => {
    invalidateAfterMutation(qc, []);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
