// Headline numbers of the statistics page: XP, lessons, exercises, first-try accuracy, study time
// and the cards that made it into long-term memory.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck, BrainCircuit, Clock3, Code2, Target, Zap } from 'lucide-react';
import { formatDuration, formatNumber, formatPercent, type Overview } from '../../lib/stats';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { ProgressBar } from '../ui/primitives';
import { Tooltip } from '../ui/Tooltip';

interface Tile {
  key: string;
  icon: ReactNode;
  label: string;
  value: ReactNode;
  hint: ReactNode;
  progress?: number;
  help?: string;
}

export default function StatTiles({ o, weekXp, weekSeconds }: { o: Overview; weekXp: number; weekSeconds: number }) {
  const tiles: Tile[] = [
    {
      key: 'xp',
      icon: <Zap className="size-4 text-xp" aria-hidden />,
      label: 'Toplam XP',
      value: <AnimatedNumber value={o.xp} />,
      hint: weekXp ? `Son 7 günde +${formatNumber(weekXp)}` : 'Bu hafta henüz XP yok',
    },
    {
      key: 'lessons',
      icon: <BookOpenCheck className="size-4 text-accent" aria-hidden />,
      label: 'Tamamlanan ders',
      value: (
        <>
          <AnimatedNumber value={o.lessonsDone} />
          <span className="text-base font-medium text-subtle">/{formatNumber(o.lessonsTotal)}</span>
        </>
      ),
      hint: o.lessonsTotal ? `${formatPercent(o.lessonsDone / o.lessonsTotal)} tamamlandı` : 'Henüz ders yok',
      progress: o.lessonsTotal ? o.lessonsDone / o.lessonsTotal : 0,
    },
    {
      key: 'exercises',
      icon: <Code2 className="size-4 text-info" aria-hidden />,
      label: 'Çözülen alıştırma',
      value: (
        <>
          <AnimatedNumber value={o.exercisesSolved} />
          <span className="text-base font-medium text-subtle">/{formatNumber(o.exercisesTotal)}</span>
        </>
      ),
      hint: 'Çözüme bakmadan',
      progress: o.exercisesTotal ? o.exercisesSolved / o.exercisesTotal : 0,
    },
    {
      key: 'accuracy',
      icon: <Target className="size-4 text-success" aria-hidden />,
      label: 'İlk deneme doğruluğu',
      value: formatPercent(o.firstTryAccuracy),
      hint: o.answered ? `${formatNumber(o.answered)} soruda` : 'Henüz soru cevaplamadın',
      help: 'Bir soruyu ilk karşılaştığında doğru cevaplama oranın. Sonraki denemeler bu oranı değiştirmez.',
    },
    {
      key: 'time',
      icon: <Clock3 className="size-4 text-streak" aria-hidden />,
      label: 'Çalışma süresi',
      value: o.studySeconds ? formatDuration(o.studySeconds) : '0 dk',
      hint: weekSeconds ? `Son 7 günde ${formatDuration(weekSeconds)}` : 'Bu hafta henüz yok',
      help: 'Ders, tekrar ve antrenmanlarda aktif geçirdiğin süre. Uzun süre işlem yapmadığın anlar sayılmaz.',
    },
    {
      key: 'memory',
      icon: <BrainCircuit className="size-4 text-gold" aria-hidden />,
      label: 'Uzun süreli hafızada',
      value: (
        <>
          <AnimatedNumber value={o.longTermCards} />
          <span className="text-base font-medium text-subtle"> kart</span>
        </>
      ),
      hint: o.activeCards ? `${formatNumber(o.activeCards)} kartın içinde` : 'Henüz kartın yok',
      help: 'Şu an %90’dan yüksek olasılıkla hatırladığın ve unutması 21 günden uzun sürecek kartlar.',
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @5xl:grid-cols-6">
      {tiles.map((t, i) => (
        <motion.li
          key={t.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, type: 'spring', stiffness: 260, damping: 26 }}
          className="flex flex-col rounded-3xl border border-border bg-surface p-4"
        >
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <span className="grid size-7 place-items-center rounded-lg bg-surface-2">{t.icon}</span>
            {t.help ? (
              <Tooltip content={t.help}>
                <span tabIndex={0} className="cursor-help rounded underline decoration-border-strong decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  {t.label}
                </span>
              </Tooltip>
            ) : (
              t.label
            )}
          </div>
          <div className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] text-fg">{t.value}</div>
          <div className="mt-auto pt-2.5">
            {t.progress !== undefined && <ProgressBar value={t.progress} height={4} className="mb-2" label={t.label} />}
            <div className="text-xs text-subtle">{t.hint}</div>
          </div>
        </motion.li>
      ))}
    </ul>
  );
}
