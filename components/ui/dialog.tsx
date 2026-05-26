'use client';

import * as React from 'react';

import { useComposedRefs } from '../../hooks/useComposedRefs';
import { useControllableState } from '../../hooks/useControllableState';
import { cn } from '../../lib/utils';
import { Icon } from './icons';
import { Slot } from './Slot';

// ── Context ───────────────────────────────────────────────────────────────────

type DialogContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = React.createContext<DialogContextValue>({
  open: false,
  setOpen: () => {},
  titleId: '',
  descriptionId: '',
});

// ── Dialog (root) ─────────────────────────────────────────────────────────────

type DialogProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
};

const Dialog: React.FC<DialogProps> = ({ open: controlledOpen, defaultOpen = false, onOpenChange, children }) => {
  const [open, setOpen] = useControllableState({
    value: controlledOpen,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  const uid = React.useId();
  const ctx = React.useMemo(
    () => ({
      open: open ?? false,
      setOpen: (next: boolean) => setOpen(next),
      titleId: `${uid}-title`,
      descriptionId: `${uid}-desc`,
    }),
    [open, setOpen, uid],
  );
  return <DialogContext.Provider value={ctx}>{children}</DialogContext.Provider>;
};
Dialog.displayName = 'Dialog';

// ── DialogTrigger ─────────────────────────────────────────────────────────────

type DialogTriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };

const DialogTrigger = React.forwardRef<HTMLButtonElement, DialogTriggerProps>(
  ({ asChild = false, onClick, children, ...props }, ref) => {
    const { setOpen } = React.useContext(DialogContext);
    const Comp = asChild ? (Slot as React.ElementType) : 'button';
    return (
      <Comp
        ref={ref}
        type="button"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          setOpen(true);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
DialogTrigger.displayName = 'DialogTrigger';

// ── DialogPortal ──────────────────────────────────────────────────────────────
// <dialog> manages its own top-layer; portal is a transparent pass-through.

const DialogPortal: React.FC<{ children?: React.ReactNode }> = ({ children }) => <>{children}</>;
DialogPortal.displayName = 'DialogPortal';

// ── DialogOverlay ─────────────────────────────────────────────────────────────
// No-op shim — real backdrop is <dialog>::backdrop styled in globals.css.

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>((_props, _ref) => null);
DialogOverlay.displayName = 'DialogOverlay';

// ── DialogContent ─────────────────────────────────────────────────────────────

type DialogContentProps = React.HTMLAttributes<HTMLDialogElement>;

const DialogContent = React.forwardRef<HTMLDialogElement, DialogContentProps>(
  ({ className, children, onClick, ...props }, ref) => {
    const { open, setOpen, titleId, descriptionId } = React.useContext(DialogContext);
    const dialogRef = React.useRef<HTMLDialogElement>(null);
    const composedRef = useComposedRefs(ref, dialogRef);

    // Promote to native modal mode whenever the dialog opens so the browser
    // controls backdrop rendering/interactions via ::backdrop + top-layer semantics.
    React.useLayoutEffect(() => {
      if (!open) return;

      const d = dialogRef.current;
      if (!d) return;

      if (typeof d.showModal === 'function') {
        try {
          if (d.open) d.close();
          d.showModal();
        } catch {
          // Best effort only.
        }
        // Some test environments expose showModal without toggling the open flag.
        if (!d.open) d.setAttribute('open', '');
      } else {
        // Fallback for environments without showModal.
        d.setAttribute('open', '');
      }

      return () => {
        try {
          if (d.open && typeof d.close === 'function') d.close();
        } catch {
          // Ignore cleanup failures.
        }
      };
    }, [open]);

    // Prevent the native cancel event so the browser's ESC→cancel→close chain
    // doesn't run; we handle ESC ourselves via the document keydown listener below.
    React.useEffect(() => {
      if (!open) return;

      const dialog = dialogRef.current;
      if (!dialog) return;
      const preventCancel = (e: Event) => e.preventDefault();
      dialog.addEventListener('cancel', preventCancel);
      return () => dialog.removeEventListener('cancel', preventCancel);
    }, [open]);

    // ESC keydown on document — works in real browsers and jsdom tests
    React.useEffect(() => {
      if (!open) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') setOpen(false);
      };
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, setOpen]);

    if (!open) return null;

    return (
      <dialog
        ref={composedRef}
        className={cn('octo-dialog__content', className)}
        data-state="open"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events
        onClick={(e) => {
          // Backdrop click: the click target is the <dialog> element itself
          if (e.target === e.currentTarget) setOpen(false);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
        <button type="button" className="octo-dialog__close" onClick={() => setOpen(false)} aria-label="Close">
          <Icon.X />
          <span className="octo-sr-only">Close</span>
        </button>
      </dialog>
    );
  },
);
DialogContent.displayName = 'DialogContent';

// ── DialogClose ───────────────────────────────────────────────────────────────

type DialogCloseProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean };

const DialogClose = React.forwardRef<HTMLButtonElement, DialogCloseProps>(
  ({ asChild = false, onClick, children, ...props }, ref) => {
    const { setOpen } = React.useContext(DialogContext);
    const Comp = asChild ? (Slot as React.ElementType) : 'button';
    return (
      <Comp
        ref={ref}
        type="button"
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          setOpen(false);
          onClick?.(e);
        }}
        {...props}
      >
        {children}
      </Comp>
    );
  },
);
DialogClose.displayName = 'DialogClose';

// ── DialogHeader ──────────────────────────────────────────────────────────────

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('octo-dialog__header', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

// ── DialogFooter ──────────────────────────────────────────────────────────────

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('octo-dialog__footer', className)} {...props} />
);
DialogFooter.displayName = 'DialogFooter';

// ── DialogTitle ───────────────────────────────────────────────────────────────

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { titleId } = React.useContext(DialogContext);
    // eslint-disable-next-line jsx-a11y/heading-has-content
    return <h2 ref={ref} id={titleId} className={cn('octo-dialog__title', className)} {...props} />;
  },
);
DialogTitle.displayName = 'DialogTitle';

// ── DialogDescription ─────────────────────────────────────────────────────────

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => {
    const { descriptionId } = React.useContext(DialogContext);
    return <p ref={ref} id={descriptionId} className={cn('octo-dialog__description', className)} {...props} />;
  },
);
DialogDescription.displayName = 'DialogDescription';

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
