// Segmented control (radiogroup) with an animated selection pill and arrow-key navigation.
import { useId, useRef, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';

export interface SegmentOption<T extends string | number> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  hint?: string; // title attribute
}

export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  labelledBy,
  size = 'md',
  className,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
  labelledBy?: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const pillId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (dir: number) => {
    const next = (idx + dir + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      className={clsx('inline-flex rounded-xl border border-border bg-surface-2 p-1', className)}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          move(1);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((o, i) => {
        const active = i === idx;
        return (
          <button
            key={String(o.value)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={clsx(
              'relative inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active && (
              <motion.span
                layoutId={pillId}
                className="absolute inset-0 rounded-lg border border-border-strong bg-elevated shadow-card"
                transition={{ type: 'spring', stiffness: 500, damping: 36 }}
              />
            )}
            <span className="relative inline-flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
