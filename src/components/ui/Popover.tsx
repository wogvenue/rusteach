// Click-to-open popover anchored below its trigger. Closes on outside click and Escape
// (returning focus to the trigger). Rendered inline (absolute), so place it inside a
// container that does not clip overflow.
import { useCallback, useEffect, useId, useRef, useState, type ReactNode, type Ref } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export interface PopoverTriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: () => void;
  'aria-expanded': boolean;
  'aria-haspopup': 'dialog';
  'aria-controls': string;
}

export function Popover({
  trigger,
  children,
  align = 'end',
  label,
  className,
  panelClassName,
}: {
  trigger: (props: PopoverTriggerProps, open: boolean) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: 'start' | 'end' | 'center';
  /** Accessible name of the popover dialog. */
  label: string;
  className?: string;
  panelClassName?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    if (focusTrigger) btn.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        close(true);
      }
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey);
    // move focus into the panel for keyboard users
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], button, a[href], input, [tabindex]:not([tabindex="-1"])');
      if (document.activeElement === btn.current && btn.current?.matches(':focus-visible')) first?.focus();
    }, 30);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open, close]);

  return (
    <div ref={wrap} className={clsx('relative inline-flex', className)}>
      {trigger(
        {
          ref: btn,
          onClick: () => setOpen((o) => !o),
          'aria-expanded': open,
          'aria-haspopup': 'dialog',
          'aria-controls': id,
        },
        open,
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panel}
            id={id}
            role="dialog"
            aria-label={label}
            className={clsx(
              'no-drag absolute top-full z-[90] mt-2 origin-top rounded-2xl border border-border-strong bg-elevated text-fg shadow-pop',
              align === 'end' && 'right-0 origin-top-right',
              align === 'start' && 'left-0 origin-top-left',
              align === 'center' && 'left-1/2 -translate-x-1/2',
              panelClassName,
            )}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ type: 'spring', stiffness: 520, damping: 34 }}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && panel.current) {
                // close when tabbing out of the panel
                const nodes = panel.current.querySelectorAll<HTMLElement>('button, a[href], input, select, [tabindex]:not([tabindex="-1"])');
                const last = nodes[nodes.length - 1];
                if (!e.shiftKey && document.activeElement === last) setOpen(false);
              }
            }}
          >
            {typeof children === 'function' ? children(() => close(true)) : children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Popover;
