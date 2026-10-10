// First-try accuracy per module as horizontal bars, with the 80 % mastery threshold marked and a
// shortcut to a mixed practice of that module.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Dumbbell } from 'lucide-react';
import clsx from 'clsx';
import { BOSS_PASS_THRESHOLD } from '../../store/progress';
import { formatNumber, formatPercent, type ModuleAccuracyRow } from '../../lib/stats';
import { Tooltip } from '../ui/Tooltip';
import { ChartCard, DataTable } from './chartKit';

export default function ModuleAccuracy({ rows, className }: { rows: ModuleAccuracyRow[]; className?: string }) {
  const threshold = BOSS_PASS_THRESHOLD;
  return (
    <ChartCard
      className={className}
      title="Modüllere göre doğruluk"
      description={`İlk denemede doğru cevapladığın soruların oranı. Çizgi, modül sınavındaki %${Math.round(threshold * 100)} ustalık eşiği.`}
      empty={rows.length ? undefined : 'Bir modülde soru cevapladığında doğruluk oranın burada görünecek.'}
      table={
        <DataTable
          caption="Modüllere göre ilk deneme doğruluğu"
          columns={[
            { key: 'module', label: 'Modül' },
            { key: 'answered', label: 'Soru', align: 'right' },
            { key: 'accuracy', label: 'Doğruluk', align: 'right' },
            { key: 'open', label: 'Açık hata', align: 'right' },
          ]}
          rows={rows.map((r) => ({
            module: `${r.module.number}. ${r.module.title}`,
            answered: formatNumber(r.answered),
            accuracy: formatPercent(r.accuracy),
            open: r.openMistakes || '—',
          }))}
        />
      }
    >
      <ul className={clsx('space-y-3.5', rows.length > 6 && '-mr-2 max-h-[340px] overflow-y-auto pr-2')}>
        {rows.map((r, i) => {
          const below = r.accuracy < threshold;
          return (
            <li key={r.module.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <div className="flex min-w-0 items-center gap-2 text-sm">
                <span aria-hidden>{r.module.icon}</span>
                <span className="truncate font-medium text-fg" title={r.module.title}>
                  {r.module.title}
                </span>
                {r.openMistakes > 0 && (
                  <span className="shrink-0 rounded-full bg-danger-soft px-1.5 py-px text-[11px] font-semibold text-danger">{r.openMistakes} açık hata</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-fg lx-tabular">{formatPercent(r.accuracy)}</span>
                <Tooltip content={`${r.module.title} ile karma antrenman`}>
                  <Link
                    to={`/antrenman?modul=${r.module.id}`}
                    aria-label={`${r.module.title} modülüyle karma antrenman yap`}
                    className={clsx(
                      'grid size-7 place-items-center rounded-lg border border-transparent text-subtle outline-none transition-colors hover:border-border hover:bg-surface-2 hover:text-accent focus-visible:ring-2 focus-visible:ring-accent',
                      below && 'text-accent',
                    )}
                  >
                    <Dumbbell className="size-3.5" aria-hidden />
                  </Link>
                </Tooltip>
              </div>
              <div className="relative col-span-2 h-2 rounded-full bg-[color-mix(in_oklab,var(--c-fg)_8%,transparent)]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: 'var(--lx-chart-1)', opacity: below ? 0.6 : 1 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(2, r.accuracy * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 22, delay: 0.05 * i }}
                />
                <span
                  className="absolute -inset-y-1 w-0.5 rounded-full bg-fg/45"
                  style={{ left: `calc(${threshold * 100}% - 1px)` }}
                  aria-hidden
                />
              </div>
              <div className="col-span-2 -mt-0.5 text-[11px] text-subtle">
                {formatNumber(r.firstTry)}/{formatNumber(r.answered)} soru ilk denemede doğru
                {below ? `; ustalık eşiğine ${Math.ceil((threshold - r.accuracy) * 100)} puan var` : ''}
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
