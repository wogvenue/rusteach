// Accessible modal dialog: portal, animated backdrop + panel, focus trap, Escape / backdrop
// click to close (unless dismissible=false), focus restored to the opener on close.
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Dialog({
  open,
  onClose,
  children,
  labelledBy,
  describedBy,
  label,
  dismissible = true,
  className,
  showClose = true,
}: {
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  /** Used when there is no visible title to point labelledBy at. */
  label?: string;
  dismissible?: boolean;
  className?: string;
  showClose?: boolean;
}) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <DialogInner
          key="dialog"
          onClose={onClose}
          labelledBy={labelledBy}
          describedBy={describedBy}
          label={label}
          dismissible={dismissible}
          className={className}
          showClose={showClose}
        >
          {children}
        </DialogInner>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function DialogInner({
  onClose,
  children,
  labelledBy,
  describedBy,
  label,
  dismissible,
  className,
  showClose,
}: {
  onClose?: () => void;
  children: ReactNode;
  labelledBy?: string;
  describedBy?: string;
  label?: string;
  dismissible: boolean;
  className?: string;
  showClose: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => {
      const el = panel.current;
      if (!el) return;
      const auto = el.querySelector<HTMLElement>('[data-autofocus]') ?? el.querySelector<HTMLElement>(FOCUSABLE);
      (auto ?? el).focus();
    }, 40);
    return () => {
      window.clearTimeout(t);
      if (opener && document.contains(opener)) opener.focus();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current?.();
      }
      if (e.key === 'Tab' && panel.current) {
        const nodes = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((n) => n.offsetParent !== null);
        if (!nodes.length) {
          e.preventDefault();
          return;
        }
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && (document.activeElement === first || !panel.current.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !panel.current.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [dismissible]);

  return (
    <motion.div
      className="no-drag fixed inset-0 z-[110] grid place-items-center overflow-y-auto p-4 sm:p-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.18 } }}
    >
      <div
        className="absolute inset-0 bg-overlay backdrop-blur-[3px]"
        aria-hidden
        onClick={() => dismissible && onCloseRef.current?.()}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-label={labelledBy ? undefined : label}
        tabIndex={-1}
        className={clsx(
          'relative w-full rounded-3xl border border-border-strong bg-surface text-fg shadow-pop outline-none',
          // default width unless the caller sets its own max-w-*
          !/(^|\s)max-w-/.test(className ?? '') && 'max-w-lg',
          className,
        )}
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15 } }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        {dismissible && showClose && (
          <button
            type="button"
            onClick={() => onCloseRef.current?.()}
            className="print-hidden absolute right-3 top-3 z-10 grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Kapat"
          >
            <X className="size-[18px]" />
          </button>
        )}
        {children}
      </motion.div>
    </motion.div>
  );
}

export default Dialog;
