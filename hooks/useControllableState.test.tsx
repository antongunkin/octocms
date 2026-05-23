import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useControllableState } from './useControllableState';

describe('useControllableState — uncontrolled', () => {
  it('returns defaultValue initially', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 'hello' }));
    expect(result.current[0]).toBe('hello');
  });

  it('returns undefined when no defaultValue given', () => {
    const { result } = renderHook(() => useControllableState<string>({}));
    expect(result.current[0]).toBeUndefined();
  });

  it('updates internal state when setState is called', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 'a' }));
    act(() => result.current[1]('b'));
    expect(result.current[0]).toBe('b');
  });

  it('calls onChange when setState is called', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ defaultValue: 'a', onChange }));
    act(() => result.current[1]('b'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('accepts functional updater', () => {
    const { result } = renderHook(() => useControllableState({ defaultValue: 0 }));
    act(() => result.current[1]((prev) => (prev ?? 0) + 1));
    expect(result.current[0]).toBe(1);
  });
});

describe('useControllableState — controlled', () => {
  it('returns the controlled value', () => {
    const { result } = renderHook(() => useControllableState({ value: 'controlled' }));
    expect(result.current[0]).toBe('controlled');
  });

  it('calls onChange with new value when setState is called', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ value: 'a', onChange }));
    act(() => result.current[1]('b'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('does not update internal state (parent owns the value)', () => {
    const { result } = renderHook(() => useControllableState({ value: 'fixed' }));
    act(() => result.current[1]('changed'));
    // still returns the prop, not the internally-set value
    expect(result.current[0]).toBe('fixed');
  });

  it('reflects new prop value when it changes', () => {
    const { result, rerender } = renderHook(({ v }: { v: string }) => useControllableState({ value: v }), {
      initialProps: { v: 'first' },
    });
    expect(result.current[0]).toBe('first');
    rerender({ v: 'second' });
    expect(result.current[0]).toBe('second');
  });

  it('accepts functional updater in controlled mode', () => {
    const onChange = vi.fn();
    const { result } = renderHook(() => useControllableState({ value: 5, onChange }));
    act(() => result.current[1]((prev) => (prev ?? 0) + 10));
    expect(onChange).toHaveBeenCalledWith(15);
  });
});
