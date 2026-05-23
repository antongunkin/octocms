'use client';

import * as React from 'react';

type Updater<T> = T | ((prev: T | undefined) => T);

export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue?: T;
  onChange?: (value: T) => void;
}): [T | undefined, (next: Updater<T>) => void] {
  const [internal, setInternal] = React.useState<T | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : internal;

  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const setState = React.useCallback(
    (next: Updater<T>) => {
      const nextValue = typeof next === 'function' ? (next as (prev: T | undefined) => T)(current) : next;
      if (!isControlled) setInternal(nextValue);
      onChangeRef.current?.(nextValue);
    },
    [isControlled, current],
  );

  return [current, setState];
}
