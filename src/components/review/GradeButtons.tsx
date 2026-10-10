// The four FSRS grade buttons (keys 1-4) with the next interval each would schedule.
import type { CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Grade } from '../../lib/srs';
import { Kbd } from '../ui/primitives';

export const GRADE_META: Record<Grade, { label: string; hint: string; color: string; soft: string }> = {
  1: { label: 'Tekrar', hint: 'Hatırlayamadım', color: 'var(--c-danger)', soft: 'var(--c-danger-soft)' },
  2: { label: 'Zor', hint: 'Zorlanarak hatırladım', color: 'var(--c-warning)', soft: 'var(--c-warning-soft)' },
  3: { label: 'İyi', hint: 'Biraz düşünüp hatırladım', color: 'var(--c-success)', soft: 'var(--c-success-soft)' },
  4: { label: 'Kolay', hint: 'Hemen hatırladım', color: 'var(--c-info)', soft: 'var(--c-info-soft)' },
};

const GRADES: Grade[] = [1, 2, 3, 4];

export default function GradeButtons({ intervals, onGrade, disabled }: { intervals: Record<Grade, string>; onGrade: (g: Grade) => void; disabled?: boolean }) {
  return (
    <div>
      <div role="group" aria-label="Ne kadar iyi hatırladın?" className="grid grid-cols-4 gap-2.5">
        {GRADES.map((g, i) => {
          const meta = GRADE_META[g];
          return (
            <motion.button
              key={g}
              type="button"
              disabled={disabled}
              onClick={() => onGrade(g)}
              aria-keyshortcuts={String(g)}
              aria-label={`${meta.label}: ${meta.hint}. Sonraki gösterim ${intervals[g]} sonra.`}
              title={meta.hint}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, type: 'spring', stiffness: 400, damping: 30 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              style={{ '--g': meta.color, '--gs': meta.soft } as CSSProperties}
              className="group flex h-[68px] flex-col justify-between rounded-2xl border border-border bg-surface px-3.5 py-2.5 text-left outline-none transition-colors hover:border-(--g) hover:bg-(--gs) focus-visible:border-(--g) focus-visible:ring-2 focus-visible:ring-(--g) focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:opacity-50"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm font-semibold text-fg">
                  <span className="size-2 rounded-full bg-(--g)" aria-hidden />
                  {meta.label}
                </span>
                <Kbd>{g}</Kbd>
              </span>
              <span className="text-xs font-medium text-muted lx-tabular">{intervals[g]}</span>
            </motion.button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-subtle">
        Dürüst puanla: sonraki tekrar zamanı, ne kadar kolay hatırladığına göre hesaplanır.
      </p>
    </div>
  );
}
