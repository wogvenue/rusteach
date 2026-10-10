// Small shared UI primitives. The shell agent may restyle them but must keep the props API.
import type { HTMLAttributes, ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { useReducedMotionPref } from './motion';

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-2xl border border-border bg-surface shadow-card', className)} {...rest}>
      {children}
    </div>
  );
}

export function ProgressBar({
  value,
  color = 'var(--c-accent)',
  className,
  height = 8,
  label,
}: {
  value: number; // 0..1
  color?: string;
  className?: string;
  height?: number;
  /** Accessible name, e.g. "Modül ilerlemesi". */
  label?: string;
}) {
  const reduced = useReducedMotionPref();
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      className={clsx('w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--c-fg)_9%,transparent)]', className)}
      style={{ height }}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
    >
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={reduced ? false : { width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  stroke = 6,
  color = 'var(--c-accent)',
  trackColor = 'color-mix(in oklab, var(--c-fg) 10%, transparent)',
  children,
  label,
}: {
  value: number; // 0..1
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  children?: ReactNode;
  /** Accessible name; when omitted the ring is decorative. */
  label?: string;
}) {
  const reduced = useReducedMotionPref();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <div
      className="relative inline-grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role={label ? 'progressbar' : undefined}
      aria-label={label}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduced ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v), opacity: v > 0 ? 1 : 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 80, damping: 18 }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-xs font-semibold tabular-nums">{children}</div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'gold';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-muted border-border',
    accent: 'bg-accent-soft text-accent border-transparent',
    success: 'bg-success-soft text-success border-transparent',
    danger: 'bg-danger-soft text-danger border-transparent',
    warning: 'bg-warning-soft text-warning border-transparent',
    info: 'bg-info-soft text-info border-transparent',
    gold: 'bg-gold-soft text-gold border-transparent',
  } as const;
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold leading-5',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border border-border-strong border-b-2 bg-surface-2 px-1.5 py-px font-mono text-[11px] font-medium text-muted">
      {children}
    </kbd>
  );
}

/** Text only for screen readers. */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className="sr-only">{children}</span>;
}

/** Section heading used across shell pages: title + optional trailing action. */
export function SectionHeader({
  title,
  description,
  action,
  className,
  as: Tag = 'h2',
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: 'h2' | 'h3';
  id?: string;
}) {
  return (
    <div className={clsx('flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <Tag id={id} className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
          {title}
        </Tag>
        {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
