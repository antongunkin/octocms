import * as React from 'react';

type PossibleRef<T> = React.Ref<T> | undefined;

function assignRef<T>(ref: PossibleRef<T>, value: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') {
    ref(value);
  } else {
    (ref as React.MutableRefObject<T | null>).current = value;
  }
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]): React.RefCallback<T> {
  return React.useCallback(
    (node: T | null) => {
      for (const ref of refs) assignRef(ref, node);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs,
  );
}
