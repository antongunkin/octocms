import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useMediaCustomFolders } from './useMediaCustomFolders';

const KEY = 'octocms:media-custom-folders';

beforeEach(() => window.localStorage.clear());
afterEach(() => window.localStorage.clear());

describe('useMediaCustomFolders', () => {
  it('hydrates from localStorage on mount', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['blog', 'launch']));
    const { result } = renderHook(() => useMediaCustomFolders());
    expect(result.current.folders).toEqual(['blog', 'launch']);
  });

  it('starts empty when localStorage is empty', () => {
    const { result } = renderHook(() => useMediaCustomFolders());
    expect(result.current.folders).toEqual([]);
  });

  it('add() persists to localStorage and exposes the new value', () => {
    const { result } = renderHook(() => useMediaCustomFolders());
    act(() => result.current.add('campaigns'));
    expect(result.current.folders).toContain('campaigns');
    expect(JSON.parse(window.localStorage.getItem(KEY) || '[]')).toContain('campaigns');
  });

  it('add() is idempotent', () => {
    const { result } = renderHook(() => useMediaCustomFolders());
    act(() => result.current.add('campaigns'));
    act(() => result.current.add('campaigns'));
    expect(result.current.folders.filter((f) => f === 'campaigns').length).toBe(1);
  });

  it('remove() drops the value from state and storage', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['campaigns', 'launch']));
    const { result } = renderHook(() => useMediaCustomFolders());
    act(() => result.current.remove('campaigns'));
    expect(result.current.folders).toEqual(['launch']);
    expect(JSON.parse(window.localStorage.getItem(KEY) || '[]')).toEqual(['launch']);
  });

  it('ignores malformed JSON in localStorage', () => {
    window.localStorage.setItem(KEY, '{not json}');
    const { result } = renderHook(() => useMediaCustomFolders());
    expect(result.current.folders).toEqual([]);
  });

  it('filters non-string values from a previously corrupted array', () => {
    window.localStorage.setItem(KEY, JSON.stringify(['ok', 42, null, 'fine']));
    const { result } = renderHook(() => useMediaCustomFolders());
    expect(result.current.folders).toEqual(['ok', 'fine']);
  });

  it('cross-tab storage events update the in-memory state', () => {
    const { result } = renderHook(() => useMediaCustomFolders());
    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify(['fromOtherTab']));
      window.dispatchEvent(new StorageEvent('storage', { key: KEY }));
    });
    expect(result.current.folders).toEqual(['fromOtherTab']);
  });
});
