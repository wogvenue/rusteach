// A week-at-a-glance strip of upcoming reviews (calendar style: one cell per day, count + bar).
import clsx from 'clsx';
import { motion } from 'framer-motion';
import type { ForecastDay } from '../../lib/stats';

export default function ForecastStrip({ days, className }: { days: ForecastDay[]; className?: string }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((n, d) => n + d.total, 0);
  return (
    <figure className={clsx('w-full', className)}>
      <ol className="grid grid-cols-7 gap-1.5" aria-label={`Önümüzdeki ${days.length} günde toplam ${total} tekrar`}>
        {days.map((d, i) => (
          <li
            key={d.key}
            className="flex flex-col items-center rounded-xl border border-border bg-surface-2/50 px-1 pb-2 pt-2.5"
            aria-label={`${d.label}: ${d.total} tekrar`}
          >
            <div className="flex h-14 w-3 items-end overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <motion.div
                className="w-full rounded-full"
                style={{ background: 'var(--lx-chart-1)' }}
                initial={{ height: 0 }}
                animate={{ height: `${d.total ? Math.max(8, (d.total / max) * 100) : 0}%` }}
                transition={{ type: 'spring', stiffness: 140, damping: 20, delay: 0.04 * i }}
              />
            </div>
            <div className={clsx('mt-2 text-sm font-semibold lx-tabular', d.total ? 'text-fg' : 'text-subtle')}>{d.total}</div>
            <div className="mt-0.5 text-[11px] font-medium text-muted">{d.offset === 0 ? 'Bugün' : d.offset === 1 ? 'Yarın' : d.weekday}</div>
          </li>
        ))}
      </ol>
    </figure>
  );
}
