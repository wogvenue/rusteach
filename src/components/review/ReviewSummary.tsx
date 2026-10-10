// End-of-session screen: accuracy, items, time, XP, how the grades were spread and the next 7 days.
import { useEffect, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Dumbbell, RotateCcw } from 'lucide-react';
import { dueReviews, useProgress, type SrsKind } from '../../store/progress';
import { formatClock, formatPercent, reviewForecast } from '../../lib/stats';
import type { Grade } from '../../lib/srs';
import { play } from '../../lib/sound';
import { celebrateBig, celebrateSmall } from '../../lib/celebrate';
import Ferris from '../Ferris';
import { Button } from '../ui/Button';
import ForecastStrip from './ForecastStrip';
import { GRADE_META } from './GradeButtons';
import { Stat } from './shared/ui';

export interface ReviewResult {
  entryId: string;
  kind: SrsKind;
  grade: Grade;
  repeat: number;
}

const GRADES: Grade[] = [1, 2, 3, 4];

function headline(accuracy: number | null): { title: string; text: string } {
  if (accuracy === null) return { title: 'Oturum tamam', text: 'Kısa da olsa her tekrar hafızana iyi gelir.' };
  if (accuracy >= 0.9) return { title: 'Muhteşem bir tekrar!', text: 'Neredeyse hepsini hatırladın. Bu kartların bir sonraki tekrarı daha da ileri bir tarihe kaydı.' };
  if (accuracy >= 0.7) return { title: 'Güzel iş!', text: 'Hatırlamak için harcadığın her çaba bu bilgileri biraz daha kalıcı yaptı.' };
  return {
    title: 'Zorlu bir tur, öğrenme tam da böyle olur',
    text: 'Unuttuğun kartlar yakında yeniden gelecek. Her başarılı hatırlama onları biraz daha sağlamlaştırır.',
  };
}

export default function ReviewSummary({
  results,
  seconds,
  xp,
  onClose,
  onMore,
}: {
  results: ReviewResult[];
  seconds: number;
  xp: number;
  onClose: () => void;
  onMore: () => void;
}) {
  const navigate = useNavigate();
  const state = useProgress();
  const firstShows = results.filter((r) => r.repeat === 0);
  const items = new Set(results.map((r) => r.entryId)).size;
  const accuracy = firstShows.length ? firstShows.filter((r) => r.grade >= 2).length / firstShows.length : null;
  const dist = GRADES.map((g) => ({ grade: g, count: firstShows.filter((r) => r.grade === g).length }));
  // Computed once for this screen: the store keeps changing (study time), the summary should not.
  const snapshot = useRef<{ forecast: ReturnType<typeof reviewForecast>; remaining: number } | null>(null);
  if (!snapshot.current) snapshot.current = { forecast: reviewForecast(state, 8).slice(1), remaining: dueReviews(state).length };
  const { forecast, remaining } = snapshot.current;
  const head = useMemo(() => headline(accuracy), [accuracy]);

  useEffect(() => {
    play('complete');
    if (remaining === 0 && items >= 5) celebrateBig();
    else if (items > 0) celebrateSmall();
  }, []); // once, when the summary appears

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative mx-auto max-w-[760px] overflow-hidden rounded-[32px] border border-border bg-surface px-6 pb-8 pt-8 sm:px-10"
      aria-labelledby="review-summary-title"
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
      <div className="relative flex flex-col items-center text-center">
        <Ferris mood="celebrate" size={112} />
        <h2 id="review-summary-title" className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          {head.title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{head.text}</p>
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        <Stat label="Hatırlama oranı" value={formatPercent(accuracy)} hint="İlk gösterimde" />
        <Stat label="Tekrar edilen" value={items} hint={results.length > items ? `${results.length - items} ikinci gösterim` : 'kart ve soru'} />
        <Stat label="Süre" value={formatClock(seconds)} hint="dk:sn" />
        <Stat label="Kazanılan XP" value={`+${Math.max(0, xp)}`} hint="bu oturumda" />
      </div>

      {firstShows.length > 0 && (
        <div className="relative mt-6">
          <h3 className="text-xs font-semibold text-muted">Puanlarının dağılımı</h3>
          <div className="mt-2 flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            {dist
              .filter((d) => d.count > 0)
              .map((d) => (
                <motion.div
                  key={d.grade}
                  className="h-full first:rounded-l-full last:rounded-r-full"
                  style={{ background: GRADE_META[d.grade].color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(d.count / firstShows.length) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
                />
              ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {dist.map((d) => (
              <li key={d.grade} className="flex items-center gap-1.5 text-xs text-muted">
                <span className="size-2 rounded-full" style={{ background: GRADE_META[d.grade].color }} aria-hidden />
                {GRADE_META[d.grade].label}
                <span className="font-semibold text-fg lx-tabular">{d.count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="relative mt-6">
        <h3 className="text-xs font-semibold text-muted">Önümüzdeki 7 gün</h3>
        <ForecastStrip days={forecast} className="mt-2" />
      </div>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" onClick={onClose} className="min-w-40" autoFocus>
          Tamam
        </Button>
        {remaining > 0 && (
          <Button size="lg" variant="secondary" icon={<RotateCcw className="size-4" />} onClick={onMore}>
            {remaining} kart daha
          </Button>
        )}
        <Button size="lg" variant="ghost" icon={<Dumbbell className="size-4" />} onClick={() => navigate('/antrenman')}>
          Antrenmana geç
        </Button>
      </div>
    </motion.section>
  );
}
