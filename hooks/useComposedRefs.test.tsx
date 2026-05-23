import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { useComposedRefs } from './useComposedRefs';

describe('useComposedRefs', () => {
  it('updates a RefObject when the composed ref is called', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { result } = renderHook(() => useComposedRefs(ref));
    const div = document.createElement('div');
    result.current(div);
    expect(ref.current).toBe(div);
  });

  it('calls a callback ref when the composed ref is called', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useComposedRefs(callback));
    const div = document.createElement('div');
    result.current(div);
    expect(callback).toHaveBeenCalledWith(div);
  });

  it('updates multiple refs at once', () => {
    const refA = React.createRef<HTMLDivElement>();
    const callbackB = vi.fn();
    const { result } = renderHook(() => useComposedRefs(refA, callbackB));
    const div = document.createElement('div');
    result.current(div);
    expect(refA.current).toBe(div);
    expect(callbackB).toHaveBeenCalledWith(div);
  });

  it('sets RefObject to null on unmount (null node)', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { result } = renderHook(() => useComposedRefs(ref));
    const div = document.createElement('div');
    result.current(div);
    result.current(null);
    expect(ref.current).toBeNull();
  });

  it('skips undefined refs without throwing', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { result } = renderHook(() => useComposedRefs(undefined, ref));
    const div = document.createElement('div');
    expect(() => result.current(div)).not.toThrow();
    expect(ref.current).toBe(div);
  });

  it('returns a stable callback ref across renders', () => {
    const ref = React.createRef<HTMLDivElement>();
    const { result, rerender } = renderHook(() => useComposedRefs(ref));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
