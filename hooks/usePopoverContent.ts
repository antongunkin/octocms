import * as React from 'react';

export type PopoverAlign = 'start' | 'center' | 'end';

export type UsePopoverContentOptions = {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

/**
 * Shared behaviour for popover-style content panels (DropdownMenu, Select).
 *
 * Handles three concerns that are identical across both primitives:
 *  1. Auto-focus the first focusable item when opened (enables keyboard nav).
 *  2. Light-dismiss on pointer-down outside content + trigger.
 *  3. Escape key close.
 *
 * Positioning is handled purely by CSS: content uses `position: absolute`
 * inside a `position: relative` root wrapper — no scroll tracking needed.
 *
 * Returns a `contentRef` the component should attach to its content element.
 * The component remains responsible for merging `contentRef` with any forwarded
 * external ref (e.g. via `useComposedRefs`).
 */
export function usePopoverContent<T extends HTMLElement = HTMLDivElement>({
  open,
  setOpen,
  triggerRef,
}: UsePopoverContentOptions) {
  const contentRef = React.useRef<T | null>(null);

  // ── 1. Auto-focus first item so arrow keys work immediately ────────────
  React.useEffect(() => {
    if (!open || !contentRef.current) return;
    const first = contentRef.current.querySelector<HTMLElement>(
      '[role="menuitem"]:not([data-disabled]), [role="option"]:not([data-disabled])',
    );
    first?.focus();
  }, [open]);

  // ── 2. Light-dismiss ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (contentRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, setOpen, triggerRef]);

  // ── 3. Escape close ──────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  return { contentRef };
}
