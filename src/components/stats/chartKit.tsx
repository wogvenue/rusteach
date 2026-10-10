// Shared pieces of the statistics charts: card frame with a chart / table switch, legend items,
// tooltip box, axis styling and the stacked-bar segment shape (rounded data end + 2px surface gap).
import { useId, useState, type ReactNode } from 'react';
import clsx from 'clsx';
import { BarChart3, Table2 } from 'lucide-react';
import type { BarShapeProps } from 'recharts';
import { useReducedMotionSetting } from '../review/shared/hooks';

/** The part of Recharts' tooltip content props our custom tooltips read. */
export interface ChartTooltipProps {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown }>;
}

export const AXIS_TICK = { fill: 'var(--c-subtle)', fontSize: 11 } as const;
export const GRID_STROKE = 'var(--lx-grid)';

/** Recharts animations follow the in-app / OS reduced-motion preference. */
export function useChartAnimation(): boolean {
  return !useReducedMotionSetting();
}

export function LegendItem({ color, label, kind = 'bar' }: { color: string; label: string; kind?: 'bar' | 'line' | 'dot' }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      {kind === 'line' ? (
        <span className="h-0.5 w-4 rounded-full" style={{ background: color }} aria-hidden />
      ) : kind === 'dot' ? (
        <span className="size-2.5 rounded-full border-2 border-surface" style={{ background: color }} aria-hidden />
      ) : (
        <span className="size-2.5 rounded-[3px]" style={{ background: color }} aria-hidden />
      )}
      {label}
    </span>
  );
}

export function TooltipBox({ title, rows, note }: { title: ReactNode; rows: { label: string; value: ReactNode; color?: string }[]; note?: ReactNode }) {
  return (
    <div className="min-w-40 rounded-xl border border-border-strong bg-elevated px-3 py-2.5 text-xs shadow-pop">
      <div className="mb-1.5 font-semibold text-fg">{title}</div>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-1.5 text-muted">
              {r.color && <span className="size-2 rounded-[2px]" style={{ background: r.color }} aria-hidden />}
              {r.label}
            </span>
            <span className="font-semibold text-fg lx-tabular">{r.value}</span>
          </div>
        ))}
      </div>
      {note && <div className="mt-1.5 border-t border-border pt-1.5 text-muted">{note}</div>}
    </div>
  );
}

export interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
}

/** Plain data table: the accessible alternative to every chart. */
export function DataTable({ caption, columns, rows }: { caption: string; columns: Column[]; rows: Record<string, ReactNode>[] }) {
  return (
    <div className="max-h-[260px] overflow-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={clsx('px-3 py-2 text-xs font-semibold text-muted', c.align === 'right' ? 'text-right' : 'text-left')}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c.key} className={clsx('px-3 py-1.5 text-fg', c.align === 'right' ? 'text-right lx-tabular' : 'text-left')}>
                  {r[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Card for one chart: heading, optional legend row, the chart (or its data table) and an optional
 * footnote. `empty` replaces the chart with a short message when there is nothing to plot yet.
 */
export function ChartCard({
  title,
  description,
  legend,
  table,
  children,
  footer,
  empty,
  className,
}: {
  title: string;
  description?: ReactNode;
  legend?: ReactNode;
  table?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  const id = useId();
  return (
    <section className={clsx('flex flex-col rounded-3xl border border-border bg-surface p-5', className)} aria-labelledby={`${id}-title`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-base font-semibold tracking-[-0.01em] text-fg">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-sm leading-relaxed text-muted">{description}</p>}
        </div>
        {table && !empty && (
          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-pressed={showTable}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-xs font-semibold text-muted outline-none transition-colors hover:border-border-strong hover:text-fg focus-visible:ring-2 focus-visible:ring-accent"
          >
            {showTable ? <BarChart3 className="size-3.5" aria-hidden /> : <Table2 className="size-3.5" aria-hidden />}
            {showTable ? 'Grafik' : 'Tablo'}
          </button>
        )}
      </div>
      {legend && !empty && !showTable && <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">{legend}</div>}
      <div className="mt-4 flex-1">
        {empty ? (
          <div className="grid h-full min-h-[180px] place-items-center rounded-2xl border border-dashed border-border-strong px-6 py-8 text-center text-sm text-muted">
            {empty}
          </div>
        ) : showTable ? (
          table
        ) : (
          children
        )}
      </div>
      {footer && <div className="mt-4 text-xs leading-relaxed text-muted">{footer}</div>}
    </section>
  );
}

/**
 * Bar segment for stacked bars: rounds the data end (top) only when it is the topmost non-empty
 * segment, and leaves a 2px surface gap above a segment that has another one stacked on it.
 */
export function StackSegment({ x, y, width, height, fill, top }: BarShapeProps & { top: boolean }) {
  if (!height || height <= 0 || !width) return null;
  const gap = top ? 0 : Math.min(2, height / 2);
  const h = height - gap;
  const yy = y + gap;
  const r = top ? Math.min(4, width / 2, h) : 0;
  const d = r
    ? `M${x},${yy + h} L${x},${yy + r} Q${x},${yy} ${x + r},${yy} L${x + width - r},${yy} Q${x + width},${yy} ${x + width},${yy + r} L${x + width},${yy + h} Z`
    : `M${x},${yy + h} L${x},${yy} L${x + width},${yy} L${x + width},${yy + h} Z`;
  return <path d={d} fill={fill} />;
}

/** Round axis ticks (0 … top) with at most `maxTicks` intervals, e.g. 243 → [0, 50, 100, 150, 200, 250]. */
export function niceTicks(max: number, maxTicks = 5): number[] {
  const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
  const target = Math.max(1, max);
  const step = steps.find((s) => target / s <= maxTicks) ?? Math.ceil(target / maxTicks);
  const top = Math.ceil(target / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}
