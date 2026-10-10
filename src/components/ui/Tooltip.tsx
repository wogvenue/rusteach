// Tooltips rendered in a portal with fixed positioning, so they are never clipped by scroll
// containers or rounded panels. <Tooltip> wraps a trigger; <FloatingCard> positions arbitrary
// content next to a DOMRect (used by the heatmap and the journey map).
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';

export type Side = 'top' | 'bottom' | 'left' | 'right';

const GAP = 10;
const MARGIN = 8;

function place(anchor: DOMRect, size: { w: number; h: number }, side: Side): { left: number; top: number; side: Side } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let s = side;
  // flip when there is not enough room
  if (s === 'top' && anchor.top - size.h - GAP < MARGIN) s = 'bottom';
  else if (s === 'bottom' && anchor.bottom + size.h + GAP > vh - MARGIN) s = 'top';
  else if (s === 'right' && anchor.right + size.w + GAP > vw - MARGIN) s = 'left';
  else if (s === 'left' && anchor.left - size.w - GAP < MARGIN) s = 'right';
  let left: number;
  let top: number;
  if (s === 'top' || s === 'bottom') {
    left = anchor.left + anchor.width / 2 - size.w / 2;
    top = s === 'top' ? anchor.top - size.h - GAP : anchor.bottom + GAP;
  } else {
    top = anchor.top + anchor.height / 2 - size.h / 2;
    left = s === 'left' ? anchor.left - size.w - GAP : anchor.right + GAP;
  }
  left = Math.max(MARGIN, Math.min(left, vw - size.w - MARGIN));
  top = Math.max(MARGIN, Math.min(top, vh - size.h - MARGIN));
  return { left, top, side: s };
}

const offsets: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: 4 },
  bottom: { x: 0, y: -4 },
  left: { x: 4, y: 0 },
  right: { x: -4, y: 0 },
};

/** Positions `children` next to `anchor` (viewport rect). Pass anchor=null to hide. */
export function FloatingCard({
  anchor,
  side = 'top',
  children,
  className,
  id,
  role = 'tooltip',
}: {
  anchor: DOMRect | null;
  side?: Side;
  children: ReactNode;
  className?: string;
  id?: string;
  role?: string;
}) {
  return createPortal(
    <AnimatePresence>
      {anchor && (
        <FloatingInner key="f" anchor={anchor} side={side} className={className} id={id} role={role}>
          {children}
        </FloatingInner>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function FloatingInner({
  anchor,
  side,
  children,
  className,
  id,
  role,
}: {
  anchor: DOMRect;
  side: Side;
  children: ReactNode;
  className?: string;
  id?: string;
  role: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; side: Side } | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const next = place(anchor, { w: el.offsetWidth, h: el.offsetHeight }, side);
    setPos((p) => (p && p.left === next.left && p.top === next.top && p.side === next.side ? p : next));
  }, [anchor, side, children]);
  const o = offsets[pos?.side ?? side];
  return (
    <motion.div
      ref={ref}
      id={id}
      role={role}
      className={clsx('no-drag pointer-events-none fixed z-[120]', className)}
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999 }}
      initial={{ opacity: 0, x: o.x, y: o.y, scale: 0.98 }}
      animate={{ opacity: pos ? 1 : 0, x: 0, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.08 } }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
    >
      {children}
    </motion.div>
  );
}

/** Classic tooltip bubble styling (also handy for FloatingCard). */
export const tooltipBubble =
  'max-w-64 rounded-lg border border-border-strong bg-elevated px-2.5 py-1.5 text-xs font-medium leading-snug text-fg shadow-pop';

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 350,
  className,
  bubbleClassName,
  disabled,
}: {
  content: ReactNode;
  children: ReactNode;
  side?: Side;
  delay?: number;
  className?: string;
  /** Replaces the default bubble styling (pass a card style for rich content). */
  bubbleClassName?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);

  const hide = useCallback(() => {
    window.clearTimeout(timer.current);
    setAnchor(null);
  }, []);
  const show = useCallback(
    (immediate = false) => {
      if (disabled) return;
      window.clearTimeout(timer.current);
      const run = () => wrap.current && setAnchor(wrap.current.getBoundingClientRect());
      if (immediate) run();
      else timer.current = window.setTimeout(run, delay);
    },
    [delay, disabled],
  );

  useEffect(() => {
    if (!anchor) return;
    const onScroll = () => hide();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && hide();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [anchor, hide]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <span
      ref={wrap}
      className={clsx('inline-flex', className)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(e) => {
        // only on keyboard focus
        if ((e.target as HTMLElement).matches?.(':focus-visible')) show(true);
      }}
      onBlur={hide}
      aria-describedby={anchor ? id : undefined}
    >
      {children}
      <FloatingCard anchor={anchor} side={side} id={id} className={bubbleClassName ?? tooltipBubble}>
        {content}
      </FloatingCard>
    </span>
  );
}

export default Tooltip;
