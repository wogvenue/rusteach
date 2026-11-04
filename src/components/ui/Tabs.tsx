// Tabs with an animated underline; arrow keys move between tabs (automatic activation).
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  icon?: ReactNode;
  count?: number;
}

export function tabIds(base: string, id: string) {
  return { tab: `${base}-tab-${id}`, panel: `${base}-panel-${id}` };
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  idBase,
  label,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** Prefix for tab/panel ids; use tabIds(idBase, id).panel on the matching panel. */
  idBase: string;
  label: string;
  className?: string;
}) {
  const underline = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, tabs.findIndex((t) => t.id === value));
  useEffect(() => {
    // keep the active tab visible when the strip scrolls sideways (phones)
    const el = refs.current[idx];
    const strip = el?.parentElement;
    if (el && strip && strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: el.offsetLeft - (strip.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
    }
  }, [idx]);
  const go = (i: number) => {
    const n = (i + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      // the bottom rule is an inset shadow so the strip can scroll sideways on phones without clipping it
      className={clsx('flex items-center gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--c-border)] [scrollbar-width:none]', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          go(idx + 1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          go(idx - 1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          go(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          go(tabs.length - 1);
        }
      }}
    >
      {tabs.map((t, i) => {
        const active = i === idx;
        const ids = tabIds(idBase, t.id);
        return (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={ids.tab}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={ids.panel}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={clsx(
              'relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-lg px-3.5 text-sm font-semibold transition-colors max-sm:px-2.5 max-sm:[&>svg]:hidden',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
            {t.count !== undefined && (
              <span
                className={clsx(
                  'rounded-full px-1.5 text-[11px] font-semibold tabular-nums leading-5',
                  active ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-muted',
                )}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={underline}
                className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-accent"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
