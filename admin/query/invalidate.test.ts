import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  applyDomainInvalidation,
  attachCrossTabInvalidationListener,
  invalidateAfterMutation,
  invalidateAfterMutationAsync,
  parseCrossTabInvalidatePayload,
  postCrossTabInvalidation,
} from './invalidate';
import { queryKeys } from './keys';

let qc: QueryClient;
let invalidateSpy: ReturnType<typeof vi.fn>;
let postMessageSpy: ReturnType<typeof vi.fn>;
let closeSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  qc = new QueryClient();
  invalidateSpy = vi.fn();
  qc.invalidateQueries = invalidateSpy as unknown as QueryClient['invalidateQueries'];
  postMessageSpy = vi.fn();
  closeSpy = vi.fn();
  vi.stubGlobal(
    'BroadcastChannel',
    class {
      name: string;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      postMessage = postMessageSpy;
      close = closeSpy;
      constructor(channelName: string) {
        this.name = channelName;
      }
    } as unknown as typeof BroadcastChannel,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function calls() {
  return invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
}

describe('invalidateAfterMutation', () => {
  it('entries → invalidates only entries', async () => {
    invalidateAfterMutation(qc, ['entries']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(calls()).toEqual([queryKeys.entries.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['entries'] });
  });

  it('media → invalidates only media', async () => {
    invalidateAfterMutation(qc, ['media']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(calls()).toEqual([queryKeys.media.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['media'] });
  });

  it('agent → invalidates only agent', async () => {
    invalidateAfterMutation(qc, ['agent']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(calls()).toEqual([queryKeys.agent.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['agent'] });
  });

  it('schema → invalidates schema AND entries (field renames bubble through)', async () => {
    invalidateAfterMutation(qc, ['schema']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(calls()).toEqual([queryKeys.schema.all, queryKeys.entries.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['schema'] });
  });

  it('git → invalidates git AND entries (branch flip changes content)', async () => {
    invalidateAfterMutation(qc, ['git']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    expect(calls()).toEqual([queryKeys.git.all, queryKeys.entries.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['git'] });
  });

  it('dedupes shared keys across multiple domains', async () => {
    invalidateAfterMutation(qc, ['schema', 'git']);
    await vi.waitFor(() => expect(postMessageSpy).toHaveBeenCalled());
    const fingerprints = calls().map((k) => JSON.stringify(k));
    const uniqueCount = new Set(fingerprints).size;
    expect(fingerprints.length).toBe(uniqueCount);
    expect(fingerprints).toEqual([
      JSON.stringify(queryKeys.schema.all),
      JSON.stringify(queryKeys.entries.all),
      JSON.stringify(queryKeys.git.all),
    ]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['schema', 'git'] });
  });

  it('empty domain list is a no-op', async () => {
    invalidateAfterMutation(qc, []);
    await Promise.resolve();
    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

describe('applyDomainInvalidation', () => {
  it('does not broadcast (listener-only path)', async () => {
    applyDomainInvalidation(qc, ['entries']);
    await vi.waitFor(() => expect(invalidateSpy).toHaveBeenCalled());
    await Promise.resolve();
    expect(calls()).toEqual([queryKeys.entries.all]);
    expect(postMessageSpy).not.toHaveBeenCalled();
  });
});

describe('invalidateAfterMutationAsync', () => {
  it('awaits invalidation then posts broadcast', async () => {
    await invalidateAfterMutationAsync(qc, ['entries']);
    expect(calls()).toEqual([queryKeys.entries.all]);
    expect(postMessageSpy).toHaveBeenCalledWith({ v: 1, domains: ['entries'] });
  });
});

describe('parseCrossTabInvalidatePayload', () => {
  it('accepts valid v1 payloads', () => {
    expect(parseCrossTabInvalidatePayload({ v: 1, domains: ['entries', 'git'] })).toEqual(['entries', 'git']);
  });

  it('rejects wrong version', () => {
    expect(parseCrossTabInvalidatePayload({ v: 2, domains: ['entries'] })).toBeNull();
  });

  it('rejects unknown domain strings', () => {
    expect(parseCrossTabInvalidatePayload({ v: 1, domains: ['entries', 'nope'] })).toBeNull();
  });
});

describe('attachCrossTabInvalidationListener + postCrossTabInvalidation', () => {
  it('relays domains to another QueryClient (sibling tab simulation)', () => {
    vi.unstubAllGlobals();

    const insts: MockBC[] = [];

    class MockBC {
      name: string;
      private messageHandler: ((e: MessageEvent) => void) | null = null;
      constructor(name: string) {
        this.name = name;
        insts.push(this);
      }
      addEventListener(_type: 'message', handler: (e: MessageEvent) => void) {
        this.messageHandler = handler;
      }
      removeEventListener(_type: 'message', handler: (e: MessageEvent) => void) {
        if (this.messageHandler === handler) this.messageHandler = null;
      }
      postMessage(data: unknown) {
        for (const other of insts) {
          if (other !== this && other.name === this.name && other.messageHandler) {
            other.messageHandler({ data } as MessageEvent);
          }
        }
      }
      close() {
        const i = insts.indexOf(this);
        if (i >= 0) insts.splice(i, 1);
      }
    }

    vi.stubGlobal('BroadcastChannel', MockBC as unknown as typeof BroadcastChannel);

    const qcB = new QueryClient();
    const spyB = vi.fn();
    qcB.invalidateQueries = spyB as unknown as QueryClient['invalidateQueries'];

    const disposeB = attachCrossTabInvalidationListener(qcB);

    postCrossTabInvalidation(['entries']);

    expect(spyB).toHaveBeenCalled();
    const keys = spyB.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toContainEqual(queryKeys.entries.all);

    disposeB();
    vi.unstubAllGlobals();
  });
});
