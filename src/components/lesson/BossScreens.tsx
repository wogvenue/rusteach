// Module mastery test ("boss"): intro with the rules and the result screen with per-item review.
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { CircleCheck, CircleX, EyeOff, ListChecks, LockOpen, RotateCcw, Swords, Target, Trophy } from 'lucide-react';
import type { Module, ScoredBlock } from '../../types/content';
import { BOSS_PASS_THRESHOLD } from '../../store/progress';
import Ferris from '../Ferris';
import { Button } from '../ui/Button';
import { ProgressRing } from '../ui/primitives';
import { AnimatedNumber } from '../ui/AnimatedNumber';
import { BLOCK_LABELS, blockSummary } from './gating';
import { useFocusOnMount } from './hooks';

const PASS_PCT = Math.round(BOSS_PASS_THRESHOLD * 100);

export function BossIntro({
  module,
  checks,
  exercises,
  best,
  attempts,
  asSkipTest,
  onStart,
  onExit,
}: {
  module?: Module;
  checks: number;
  exercises: number;
  best: number;
  attempts: number;
  asSkipTest: boolean;
  onStart: () => void;
  onExit: () => void;
}) {
  const rules = [
    { icon: Target, text: `Geçmek için en az %${PASS_PCT} başarı gerekiyor.` },
    {
      icon: ListChecks,
      text: `${checks} soru${exercises ? ` ve ${exercises} alıştırma` : ''} var. Her sorunun yalnızca ilk cevabı sayılır.`,
    },
    { icon: EyeOff, text: 'İpuçları ve çözümler kapalı. Cevapladıktan sonra kısa açıklamaları açabilirsin.' },
    { icon: RotateCcw, text: 'Geçemezsen dilediğin kadar yeniden deneyebilirsin; en iyi skorun saklanır.' },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:pt-14"
    >
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-9">
        <div
          className="pointer-events-none absolute -right-20 -top-28 size-80 rounded-full opacity-70 blur-3xl"
          style={{ background: `radial-gradient(circle, color-mix(in srgb, ${module?.color ?? 'var(--c-accent)'} 26%, transparent), transparent 70%)` }}
          aria-hidden="true"
        />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          <Ferris mood="thinking" size={120} className="shrink-0" />
          <div className="min-w-0">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
              <Swords className="size-3.5" /> Modül sınavı
            </div>
            <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2.2rem)] font-bold leading-tight tracking-[-0.025em] text-fg">
              {module ? `Modül ${module.number}: ${module.title}` : 'Modül sınavı'}
            </h1>
            <p className="mt-2 text-muted">
              Bu modülde öğrendiklerini karışık sorularla sına. Yeni bir şey öğretilmez; burası ustalığını gösterdiğin yer.
            </p>
          </div>
        </div>

        {asSkipTest && (
          <div className="relative mt-6 flex items-start gap-3 rounded-2xl border border-info/30 bg-info-soft p-4">
            <LockOpen className="mt-0.5 size-5 shrink-0 text-info" />
            <p className="text-sm text-fg">
              Bu sınavı modülü atlamak için alıyorsun. Geçersen bu modül ustalaşılmış sayılır ve bir sonraki modülün kilidi açılır.
            </p>
          </div>
        )}

        <ul className="relative mt-6 space-y-3">
          {rules.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-[0.95rem] text-fg">
              <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-surface-2 text-accent">
                <r.icon className="size-4" />
              </span>
              <span className="pt-1">{r.text}</span>
            </li>
          ))}
        </ul>

        {attempts > 0 && (
          <p className="relative mt-5 text-sm text-muted">
            En iyi skorun <span className="font-semibold text-fg">%{Math.round(best * 100)}</span> ({attempts} deneme).
          </p>
        )}

        <div className="relative mt-7 flex flex-wrap items-center gap-3">
          <Button size="lg" icon={<Swords className="size-5" />} onClick={onStart} autoFocus>
            Sınava başla
          </Button>
          <Button variant="ghost" onClick={onExit}>
            Şimdi değil
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

export interface BossItemResult {
  block: ScoredBlock;
  correct: boolean;
  skipped: boolean;
}

export function BossResult({
  module,
  nextModule,
  score,
  passed,
  xp,
  best,
  items,
  onRetry,
  onReview,
  onNavigate,
}: {
  module?: Module;
  nextModule?: Module;
  score: number;
  passed: boolean;
  xp: number;
  best: number;
  items: BossItemResult[];
  onRetry: () => void;
  onReview: () => void;
  onNavigate: (to: string) => void;
}) {
  const pct = Math.round(score * 100);
  const correct = items.filter((i) => i.correct).length;
  const primary = useFocusOnMount<HTMLButtonElement>();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto w-full max-w-2xl px-4 pb-16 pt-10 sm:pt-14"
      role="region"
      aria-labelledby="boss-result-title"
    >
      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <ProgressRing
            value={score}
            size={168}
            stroke={12}
            color={passed ? 'var(--c-gold)' : 'var(--c-accent)'}
            label={`Skor yüzde ${pct}`}
          >
            <span className="flex flex-col items-center">
              <span className={clsx('text-4xl font-bold tracking-tight', passed ? 'text-gold' : 'text-fg')}>
                %<AnimatedNumber value={pct} />
              </span>
              <span className="mt-0.5 text-xs font-medium text-muted">
                {correct}/{items.length} doğru
              </span>
            </span>
          </ProgressRing>
          {passed && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.5, type: 'spring', stiffness: 380, damping: 14 }}
              className="absolute -right-2 -top-1 grid size-12 place-items-center rounded-full bg-gold text-[var(--c-bg)] shadow-pop"
              aria-hidden="true"
            >
              <Trophy className="size-6" />
            </motion.span>
          )}
        </div>
        <h1 id="boss-result-title" className="mt-6 text-3xl font-bold tracking-[-0.025em] text-fg">
          {passed ? 'Modül ustalaşıldı!' : 'Bu sefer olmadı'}
        </h1>
        <p className="mt-2 max-w-md text-muted">
          {passed
            ? `${module ? `“${module.title}” modülünü` : 'Bu modülü'} %${pct} başarıyla geçtin.${
                nextModule ? ` Modül ${nextModule.number}: ${nextModule.title} artık açık.` : ''
              }`
            : `Geçmek için %${PASS_PCT} gerekiyor, sen %${pct} aldın. Aşağıdaki yanlışlara bak, ilgili dersleri tazele ve yeniden dene.`}
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-sm">
          {xp > 0 && <span className="rounded-full bg-xp/15 px-2.5 py-0.5 font-bold text-xp">+{xp} XP</span>}
          {best > score && <span className="text-xs text-subtle">En iyi skorun: %{Math.round(best * 100)}</span>}
        </div>
      </div>

      <section className="mt-9 overflow-hidden rounded-3xl border border-border bg-surface" aria-label="Soru soru sonuçlar">
        <ul className="divide-y divide-border">
          {items.map((it, i) => (
            <li key={it.block.id} className="flex items-start gap-3 px-5 py-3">
              {it.correct ? (
                <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="doğru" />
              ) : (
                <CircleX className="mt-0.5 size-5 shrink-0 text-danger" aria-label="yanlış" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-muted">
                  {i + 1}. {BLOCK_LABELS[it.block.type]}
                  {it.skipped && <span className="ml-2 font-normal text-subtle">(geçildi)</span>}
                </div>
                <div className="text-sm text-fg">{blockSummary(it.block)}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
        {passed ? (
          nextModule ? (
            <Button size="lg" onClick={() => onNavigate(`/modul/${nextModule.id}`)} ref={primary}>
              Sonraki modüle geç
            </Button>
          ) : (
            <Button size="lg" onClick={() => onNavigate('/harita')} ref={primary}>
              Yolculuk haritasına dön
            </Button>
          )
        ) : (
          <Button size="lg" icon={<RotateCcw className="size-5" />} onClick={onRetry} ref={primary}>
            Yeniden dene
          </Button>
        )}
        {module && (
          <Button size="lg" variant="secondary" onClick={() => onNavigate(`/modul/${module.id}`)}>
            Modüle dön
          </Button>
        )}
      </div>
      <div className="mt-3 flex justify-center">
        <Button variant="ghost" onClick={onReview}>
          Cevaplarımı incele
        </Button>
      </div>
    </motion.div>
  );
}
