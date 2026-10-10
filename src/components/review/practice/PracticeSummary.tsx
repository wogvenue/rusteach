// End of a practice run (karma antrenman / hata defteri turu): first-try accuracy, closed mistakes,
// time, XP and the verdict for every item.
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, CircleDashed, Eye, NotebookPen, RotateCcw, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { findBlock } from '../../../lib/content';
import { blockPreview, type PracticeItem } from '../../../lib/practice';
import { formatClock, formatPercent } from '../../../lib/stats';
import { play } from '../../../lib/sound';
import { celebrateSmall } from '../../../lib/celebrate';
import Ferris from '../../Ferris';
import { Button } from '../../ui/Button';
import { Stat } from '../shared/ui';

export type PracticeOutcome = 'correct' | 'second' | 'wrong' | 'revealed' | 'skipped';

export interface PracticeResult {
  item: PracticeItem;
  outcome: PracticeOutcome;
  repeat: number;
  resolvedMistake: boolean;
}

export const OUTCOME_META: Record<PracticeOutcome, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  correct: { label: 'İlk denemede', className: 'text-success', icon: CheckCircle2 },
  second: { label: 'İkinci denemede', className: 'text-warning', icon: CheckCircle2 },
  wrong: { label: 'Yanlış', className: 'text-danger', icon: XCircle },
  revealed: { label: 'Çözüme bakıldı', className: 'text-info', icon: Eye },
  skipped: { label: 'Geçildi', className: 'text-subtle', icon: CircleDashed },
};

function headline(acc: number | null): { title: string; text: string; mood: 'celebrate' | 'happy' | 'thinking' } {
  if (acc === null) return { title: 'Antrenman bitti', text: 'Bir dahaki sefere birkaç soruyu cevaplamayı dene; hatırlamaya çalışmak öğrenmenin kendisi.', mood: 'happy' };
  if (acc >= 0.85)
    return { title: 'Harika bir antrenman!', text: 'Bu konular yerine oturmuş. Birkaç gün sonra yeniden sorulduklarında daha da kalıcı olacaklar.', mood: 'celebrate' };
  if (acc >= 0.6)
    return { title: 'İyi gidiyorsun', text: 'Zorlandığın sorular hata defterinde. Onları birkaç gün sonra yeniden denemek en verimlisi.', mood: 'happy' };
  return {
    title: 'Zorlandığın yerleri buldun',
    text: 'Bu iyi bir şey: zorlanarak hatırlamaya çalışmak öğrenmenin ta kendisi. Hatalarını defterden yeniden dene.',
    mood: 'thinking',
  };
}

export default function PracticeSummary({
  results,
  seconds,
  xp,
  onClose,
  onRestart,
  restartLabel = 'Yeni tur',
  onOpenMistakes,
}: {
  results: PracticeResult[];
  seconds: number;
  xp: number;
  onClose: () => void;
  onRestart?: () => void;
  restartLabel?: string;
  onOpenMistakes?: () => void;
}) {
  const firsts = results.filter((r) => r.repeat === 0);
  const answered = firsts.filter((r) => r.outcome !== 'skipped');
  const correct = answered.filter((r) => r.outcome === 'correct').length;
  const acc = answered.length ? correct / answered.length : null;
  const closed = results.filter((r) => r.resolvedMistake).length;
  const struggled = answered.some((r) => r.outcome === 'wrong' || r.outcome === 'second');
  const head = useMemo(() => headline(acc), [acc]);
  const laterRight = useMemo(() => new Set(results.filter((r) => r.repeat > 0 && r.outcome === 'correct').map((r) => r.item.id)), [results]);

  useEffect(() => {
    play('complete');
    if (acc !== null && acc >= 0.85 && answered.length >= 5) celebrateSmall();
  }, []); // once, when the summary appears

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative mx-auto max-w-[760px] overflow-hidden rounded-[32px] border border-border bg-surface px-6 pb-8 pt-8 sm:px-10"
      aria-labelledby="practice-summary-title"
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
      <div className="relative flex flex-col items-center text-center">
        <Ferris mood={head.mood} size={104} />
        <h2 id="practice-summary-title" className="mt-3 text-2xl font-semibold tracking-tight text-fg">
          {head.title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">{head.text}</p>
      </div>

      <div className="relative mt-7 grid grid-cols-2 gap-2.5 @2xl:grid-cols-4">
        <Stat label="İlk denemede doğru" value={`${correct}/${answered.length}`} hint={formatPercent(acc)} />
        <Stat label="Kapanan hata" value={closed} hint={closed ? 'defterden çıktı' : 'bu turda yok'} />
        <Stat label="Süre" value={formatClock(seconds)} hint="dk:sn" />
        <Stat label="Kazanılan XP" value={`+${Math.max(0, xp)}`} hint="bu turda" />
      </div>

      {firsts.length > 0 && (
        <div className="relative mt-6">
          <h3 className="text-xs font-semibold text-muted">Sorular</h3>
          <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-2/40">
            {firsts.map((r) => {
              const loc = findBlock(r.item.id);
              const preview = loc ? blockPreview(loc.block) : null;
              const meta = OUTCOME_META[r.outcome];
              const Icon = meta.icon;
              return (
                <li key={r.item.id} className="flex items-center gap-3 px-3.5 py-2.5 text-left">
                  <Icon className={clsx('size-[18px] shrink-0', meta.className)} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-fg">{preview?.text || 'Soru'}</div>
                    <div className="truncate text-xs text-subtle">
                      {preview?.label}
                      {loc ? `, ${loc.lesson.title}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={clsx('text-xs font-semibold', meta.className)}>{meta.label}</span>
                    {r.resolvedMistake && <span className="text-[11px] text-success">Defterden çıktı</span>}
                    {laterRight.has(r.item.id) && <span className="text-[11px] text-muted">Sonra doğru</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
        {onRestart && (
          <Button size="lg" icon={<RotateCcw className="size-4" />} onClick={onRestart} autoFocus className="min-w-40">
            {restartLabel}
          </Button>
        )}
        {struggled && onOpenMistakes && (
          <Button size="lg" variant="secondary" icon={<NotebookPen className="size-4" />} onClick={onOpenMistakes}>
            Hata defterini aç
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onClose} autoFocus={!onRestart}>
          Kapat
        </Button>
      </div>
    </motion.section>
  );
}
