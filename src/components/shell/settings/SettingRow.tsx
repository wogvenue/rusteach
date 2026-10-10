// Layout pieces for the settings page: a titled section card and a label / control row.
import { useId, type ReactNode } from 'react';
import clsx from 'clsx';

export function SettingsSection({
  id,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6 rounded-3xl border border-border bg-surface shadow-card">
      <header className="flex items-center gap-3 px-6 pb-2 pt-5">
        <span className="grid size-9 place-items-center rounded-xl bg-surface-2 text-muted" aria-hidden>
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={`${id}-h`} className="text-[17px] font-semibold tracking-[-0.015em] text-fg">
            {title}
          </h2>
          {description && <p className="text-[13px] text-muted">{description}</p>}
        </div>
      </header>
      <div className="divide-y divide-border px-6 pb-2">{children}</div>
    </section>
  );
}

/**
 * One setting: label + description on the left, control on the right. `control` receives the ids
 * to wire aria-labelledby / aria-describedby.
 */
export function SettingRow({
  title,
  description,
  control,
  children,
  stack,
}: {
  title: ReactNode;
  description?: ReactNode;
  control?: (ids: { labelId: string; descId: string }) => ReactNode;
  /** Extra content under the row (previews, warnings). */
  children?: ReactNode;
  /** Put the control under the text instead of on the right. */
  stack?: boolean;
}) {
  const base = useId();
  const labelId = `${base}-l`;
  const descId = `${base}-d`;
  return (
    <div className="py-4">
      <div className={clsx('flex gap-x-6 gap-y-3', stack ? 'flex-col' : 'flex-wrap items-center justify-between')}>
        <div className="min-w-0 flex-1 basis-[260px]">
          <div id={labelId} className="text-sm font-semibold text-fg">
            {title}
          </div>
          {description && (
            <p id={descId} className="mt-0.5 max-w-[62ch] text-[13px] leading-5 text-muted">
              {description}
            </p>
          )}
        </div>
        {control && <div className="shrink-0">{control({ labelId, descId })}</div>}
      </div>
      {children}
    </div>
  );
}

/** Styled native range with a filled track and a value bubble. */
export function RangeControl({
  value,
  min,
  max,
  step,
  onChange,
  labelledBy,
  format,
  width = 220,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  labelledBy: string;
  format: (v: number) => string;
  width?: number;
}) {
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        className="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-labelledby={labelledBy}
        aria-valuetext={format(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width, ['--fill' as string]: `${fill}%` }}
      />
      <span className="w-14 text-right text-[13px] font-semibold tabular-nums text-fg">{format(value)}</span>
    </div>
  );
}
