// Presentational pieces shared by the learning-engine pages (Tekrar, Antrenman, İstatistik).
import { useId, useRef, type ReactNode } from 'react';
import { MotionConfig } from 'framer-motion';
import { ChevronDown, Search, X } from 'lucide-react';
import clsx from 'clsx';
import Ferris, { type FerrisMood } from '../../Ferris';
import { Switch } from '../../ui/Switch';
import type { Module } from '../../../types/content';
import { useReducedMotionSetting } from './hooks';
import '../learn.css';

/** Page frame: container-query root, comfortable width, motion preferences applied. */
export function LearnPage({ children, className }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotionSetting();
  return (
    <MotionConfig reducedMotion={reduced ? 'always' : 'user'}>
      <div className={clsx('@container mx-auto w-full max-w-[1240px] px-6 pb-14 pt-7 lg:px-8', className)}>{children}</div>
    </MotionConfig>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  // Same type scale as the shell pages (Ana Sayfa, Harita, Sözlük, Ayarlar).
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.03em] text-fg">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[72ch] text-[15px] leading-6 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Trusted, pre-rendered content HTML (lesson markdown → HTML at build time). */
export function Prose({ html, className }: { html: string; className?: string }) {
  return <div className={clsx('lx-prose', className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Module identity chip: emoji + title with the module's tier colour as a small dot. */
export function ModuleTag({ module, className, compact }: { module: Module; className?: string; compact?: boolean }) {
  return (
    <span
      className={clsx(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-2 py-0.5 pl-1.5 pr-2.5 text-xs font-medium text-muted',
        className,
      )}
      title={`Modül ${module.number}: ${module.title}`}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: module.color }} aria-hidden />
      <span aria-hidden>{module.icon}</span>
      <span className="truncate">{compact ? `Modül ${module.number}` : module.title}</span>
    </span>
  );
}

export function EmptyState({
  mood = 'happy',
  title,
  children,
  actions,
  className,
}: {
  mood?: FerrisMood;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx('relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-12 text-center', className)}>
      <div className="lx-hairline-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div className="relative mx-auto flex max-w-lg flex-col items-center">
        <Ferris mood={mood} size={120} />
        <h2 className="mt-4 text-xl font-semibold tracking-tight text-fg">{title}</h2>
        {children && <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div>}
        {actions && <div className="mt-6 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

/** Small label/value pair used on summary screens. */
export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-2xl border border-border bg-surface-2/60 px-4 py-3', className)}>
      <div className="text-xs font-medium text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-fg">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-subtle">{hint}</div>}
    </div>
  );
}

/** Card-like section with a heading row (title, optional description and trailing action). */
export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const autoId = useId();
  const headingId = id ?? autoId;
  return (
    <section className={clsx('rounded-3xl border border-border bg-surface p-5', className)} aria-labelledby={headingId}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

/** Search box with a clear button; Escape clears it. */
export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && value) {
            e.preventDefault();
            e.stopPropagation();
            onChange('');
          }
        }}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-9 pr-9 text-sm text-fg outline-none transition-colors placeholder:text-subtle hover:border-border-strong focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-subtle outline-none hover:bg-surface hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Aramayı temizle"
        >
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}

export interface SelectOption {
  value: string;
  label: string;
}

/** Native select (keyboard and screen-reader friendly) styled like the other fields. */
export function SelectField({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: SelectOption[];
  label: string;
  className?: string;
}) {
  return (
    <div className={clsx('relative', className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-10 w-full cursor-pointer appearance-none rounded-xl border border-border bg-surface-2 pl-3 pr-9 text-sm font-medium text-fg outline-none transition-colors hover:border-border-strong focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/30"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
    </div>
  );
}

/** Toggle chip for multi-select filters. */
export function FilterChip({
  active,
  onClick,
  children,
  title,
  color,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  /** Identity colour shown as a dot (e.g. a module colour). */
  color?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      title={title}
      onClick={onClick}
      className={clsx(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        active ? 'border-accent/50 bg-accent-soft text-fg' : 'border-border bg-surface text-muted hover:border-border-strong hover:text-fg',
      )}
    >
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} aria-hidden />}
      {children}
    </button>
  );
}

/** Setting row: visible label + description on the left, the app's switch on the right. */
export function ToggleRow({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className={clsx('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      <div className="min-w-0">
        <div id={`${id}-label`} className="text-sm font-medium text-fg">
          {label}
        </div>
        {description && (
          <div id={`${id}-desc`} className="mt-0.5 text-xs leading-relaxed text-muted">
            {description}
          </div>
        )}
      </div>
      <Switch
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        labelledBy={`${id}-label`}
        describedBy={description ? `${id}-desc` : undefined}
      />
    </div>
  );
}

/** Exercise difficulty as five small bars (1–5), with an accessible text. */
export function DifficultyMeter({ value, className }: { value: number; className?: string }) {
  return (
    <span className={clsx('inline-flex items-end gap-[3px]', className)} role="img" aria-label={`Zorluk ${value}/5`} title={`Zorluk ${value}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={clsx('w-[4px] rounded-full', i <= value ? 'bg-accent' : 'bg-border-strong')}
          style={{ height: 5 + i * 2 }}
        />
      ))}
    </span>
  );
}
