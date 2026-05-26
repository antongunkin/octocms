import * as React from 'react';

import { useComposedRefs } from '../../../hooks/useComposedRefs';

type AnyProps = Record<string, unknown>;

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps, ...childProps };

  // className: join both
  if (slotProps.className || childProps.className) {
    merged.className = [slotProps.className, childProps.className].filter(Boolean).join(' ');
  }

  // style: merge objects (child wins on conflict)
  if (slotProps.style || childProps.style) {
    merged.style = { ...(slotProps.style as object), ...(childProps.style as object) };
  }

  // event handlers: compose — child fires first, then slot
  for (const key of Object.keys(slotProps)) {
    if (key.startsWith('on') && typeof slotProps[key] === 'function' && typeof childProps[key] === 'function') {
      const slotHandler = slotProps[key] as (...a: unknown[]) => unknown;
      const childHandler = childProps[key] as (...a: unknown[]) => unknown;
      merged[key] = (...args: unknown[]) => {
        childHandler(...args);
        slotHandler(...args);
      };
    }
  }

  return merged;
}

export interface SlotProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
}

export const Slot = React.forwardRef<HTMLElement, SlotProps>(({ children, ...slotProps }, slotRef) => {
  const child = React.Children.only(children) as React.ReactElement<AnyProps & { ref?: React.Ref<HTMLElement> }>;

  const composedRef = useComposedRefs(slotRef, child.props.ref as React.Ref<HTMLElement>);
  const merged = mergeProps(slotProps as AnyProps, child.props);

  return React.cloneElement(child, { ...merged, ref: composedRef });
});

Slot.displayName = 'Slot';
