// "Hız turu": ten quick checks (quiz / derlenir mi / çıktı tahmini) against a three-minute clock.
// Fluent, fast recall is the last step of learning something. Score: 100 per correct answer plus
// 2 per second left when every question is answered. The personal best stays on this device.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BookOpen, CheckCircle2, Flame, NotebookPen, Play, RotateCcw, Timer, Trophy, X, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { nextLessonId, useProgress } from '../../../store/progress';
import { findBlock, getLesson } from '../../../lib/content';
import { blockPreview, speedRoundPool, speedRoundScore, speedRoundSet, SPEED_ROUND, type PracticeItem } from '../../../lib/practice';
import { formatClock, formatNumber, relativeDayLabel } from '../../../lib/stats';
import { play } from '../../../lib/sound';
import { celebrateBig, celebrateSmall } from '../../../lib/celebrate';
import type { BlockOutcome } from '../../blocks/types';
import { AnimatedNumber } from '../../ui/AnimatedNumber';
import { Button } from '../../ui/Button';
import { Kbd, ProgressRing } from '../../ui/primitives';
import ItemSheet from '../ItemSheet';
import { EmptyState, SectionCard } from '../shared/ui';
import { readLocal, useHotkeys, useStudyClock, writeLocal } from '../shared/hooks';

const BEST_KEY = 'rusteach-speed-best';
const HISTORY_KEY = 'rusteach-speed-history';
const TOTAL_MS = SPEED_ROUND.seconds * 1000;

interface SpeedBest {
  score: number;
  correct: number;
  total: number;
  at: string;
}

interface SpeedRun {
  score: number;
  correct: number;
  total: number;
  at: string;
}

interface Answer {
  id: string;
  correct: boolean;
  ms: number;
}

interface Finished {
  answers: Answer[];
  total: number;
  secondsLeft: number;
  finishedAll: boolean;
  score: ReturnType<typeof speedRoundScore>;
  previousBest: SpeedBest | null;
  record: boolean;
}

const RULES = [
  `Her doğru cevap ${SPEED_ROUND.pointsPerCorrect} puan.`,
  `Hepsini bitirirsen kalan her saniye +${SPEED_ROUND.pointsPerSecondLeft} puan.`,
  'Süre bitince tur biter; cevaplanmayan soru puan getirmez.',
  'Yanlışların hata defterine düşer, sonra rahatça çalışırsın.',
];

function timerColor(ms: number): string {
  if (ms <= 10_000) return 'var(--c-danger)';
  if (ms <= 30_000) return 'var(--c-warning)';
  return 'var(--c-accent)';
}

function HistoryBars({ runs, best }: { runs: SpeedRun[]; best: number }) {
  const max = Math.max(1, ...runs.map((r) => r.score));
  return (
    <figure>
      <ol className="flex h-20 items-end gap-1.5" aria-label="Son turlarının puanları">
        {runs.map((r, i) => (
          <li key={`${r.at}-${i}`} className="flex h-full flex-1 flex-col justify-end" aria-label={`${formatNumber(r.score)} puan, ${relativeDayLabel(r.at)}`} title={`${formatNumber(r.score)} puan`}>
            <motion.div
              className="w-full rounded-t-[4px] rounded-b-[2px]"
              style={{ background: r.score === best ? 'var(--lx-chart-1)' : 'var(--lx-chart-muted)' }}
              initial={{ height: 0 }}
              animate={{ height: `${Math.max(6, (r.score / max) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 160, damping: 20, delay: i * 0.03 }}
            />
          </li>
        ))}
      </ol>
      <figcaption className="mt-2 text-xs text-subtle">Son {runs.length} tur, en eskisi solda. Turuncu çubuk rekorun.</figcaption>
    </figure>
  );
}

function Intro({ poolSize, onStart }: { poolSize: number; onStart: () => void }) {
  const best = readLocal<SpeedBest | null>(BEST_KEY, null);
  const history = readLocal<SpeedRun[]>(HISTORY_KEY, []);
  const count = Math.min(SPEED_ROUND.size, poolSize);
  useHotkeys({ Enter: onStart });
  return (
    <div className="grid gap-5 @4xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-9 text-center"
        aria-labelledby="speed-title"
      >
        <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
        <div className="relative mx-auto flex max-w-md flex-col items-center">
          <div className="relative grid size-40 place-items-center">
            <ProgressRing value={1} size={160} stroke={10} label="Süre: 3 dakika">
              <span />
            </ProgressRing>
            <div className="absolute inset-0 grid place-items-center">
              <div>
                <div className="text-[44px] font-semibold leading-none tracking-[-0.03em] text-fg lx-tabular">{formatClock(SPEED_ROUND.seconds)}</div>
                <div className="mt-1.5 text-sm font-medium text-muted">{count} soru</div>
              </div>
            </div>
          </div>
          <h2 id="speed-title" className="mt-6 text-2xl font-semibold tracking-tight text-fg">
            Hız turu
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Bildiğin şeyleri hızlı hatırlamak, öğrenmenin son adımıdır. Düşünmeden cevaplayabildiğin bilgi, kod yazarken aklını
            yeni sorunlara ayırır.
          </p>
          <Button size="lg" icon={<Play className="size-4" />} onClick={onStart} className="mt-6 min-w-56">
            Turu başlat
          </Button>
          <span className="mt-2 text-xs text-subtle">
            ya da <Kbd>Enter</Kbd>
          </span>
        </div>
      </motion.section>

      <div className="flex flex-col gap-5">
        <SectionCard title="Rekorun">
          {best ? (
            <div className="flex items-center gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gold-soft text-gold">
                <Trophy className="size-6" aria-hidden />
              </span>
              <div>
                <div className="text-3xl font-semibold tracking-tight text-fg lx-tabular">{formatNumber(best.score)}</div>
                <div className="text-xs text-muted">
                  {best.correct}/{best.total} doğru, {relativeDayLabel(best.at)}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">İlk turunu oyna; rekorun burada görünecek.</p>
          )}
          {history.length > 1 && (
            <div className="mt-5">
              <HistoryBars runs={history} best={best?.score ?? 0} />
            </div>
          )}
        </SectionCard>
        <SectionCard title="Kurallar">
          <ul className="space-y-2.5">
            {RULES.map((r) => (
              <li key={r} className="flex items-start gap-2.5 text-sm text-muted">
                <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                {r}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>
    </div>
  );
}

function Results({ result, onAgain, onClose, onOpenMistakes }: { result: Finished; onAgain: () => void; onClose: () => void; onOpenMistakes: () => void }) {
  const correct = result.answers.filter((a) => a.correct).length;
  const wrong = result.answers.length - correct;
  const avg = result.answers.length ? result.answers.reduce((n, a) => n + a.ms, 0) / result.answers.length / 1000 : null;

  useEffect(() => {
    if (result.record) {
      play('achievement');
      celebrateBig();
    } else {
      play('complete');
      if (correct >= Math.ceil(result.total * 0.8)) celebrateSmall();
    }
  }, []); // once, when the results appear

  useHotkeys({ Enter: onAgain });

  return (
    <motion.section
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 220, damping: 24 }}
      className="relative mx-auto max-w-[760px] overflow-hidden rounded-[32px] border border-border bg-surface px-6 pb-8 pt-9 sm:px-10"
      aria-labelledby="speed-result-title"
    >
      <div className="pointer-events-none absolute inset-0" style={{ background: 'var(--lx-ember)' }} aria-hidden />
      <div className="relative text-center">
        <h2 id="speed-result-title" className="text-sm font-semibold text-muted">
          {result.finishedAll ? 'Tur tamamlandı' : 'Süre doldu'}
        </h2>
        <div className="mt-2 text-[72px] font-semibold leading-none tracking-[-0.04em] text-fg">
          <AnimatedNumber value={result.score.total} duration={1.2} />
        </div>
        <div className="mt-1 text-sm text-muted">puan</div>
        <AnimatePresence>
          {result.record ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 18 }}
              className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-gold-soft px-3.5 py-1.5 text-sm font-semibold text-gold"
            >
              <Trophy className="size-4" aria-hidden /> Yeni rekor!
              {result.previousBest && <span className="font-medium">Önceki: {formatNumber(result.previousBest.score)}</span>}
            </motion.div>
          ) : result.previousBest ? (
            <p className="mt-4 text-sm text-muted">
              Rekorun {formatNumber(result.previousBest.score)} puan; {formatNumber(result.previousBest.score - result.score.total)} puan
              kaldı.
            </p>
          ) : null}
        </AnimatePresence>
      </div>

      <dl className="relative mx-auto mt-7 max-w-md divide-y divide-border rounded-2xl border border-border bg-surface-2/50 text-sm">
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-muted">
            Doğru cevap: {correct} × {SPEED_ROUND.pointsPerCorrect}
          </dt>
          <dd className="font-semibold text-fg lx-tabular">{formatNumber(result.score.base)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-muted">
            {result.finishedAll
              ? `Süre bonusu: ${Math.round(result.secondsLeft)} sn × ${SPEED_ROUND.pointsPerSecondLeft}`
              : 'Süre bonusu: hepsini bitirince kazanılır'}
          </dt>
          <dd className="font-semibold text-fg lx-tabular">{formatNumber(result.score.bonus)}</dd>
        </div>
        <div className="flex items-center justify-between px-4 py-2.5">
          <dt className="text-muted">Soru başına ortalama</dt>
          <dd className="font-semibold text-fg lx-tabular">{avg === null ? '-' : `${avg.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn`}</dd>
        </div>
      </dl>

      {result.answers.length > 0 && (
        <ul className="relative mx-auto mt-5 max-w-md space-y-1.5">
          {result.answers.map((a, i) => {
            const loc = findBlock(a.id);
            const p = loc ? blockPreview(loc.block) : null;
            return (
              <li key={`${a.id}-${i}`} className="flex items-center gap-2.5 text-sm">
                {a.correct ? <CheckCircle2 className="size-4 shrink-0 text-success" aria-label="Doğru" /> : <XCircle className="size-4 shrink-0 text-danger" aria-label="Yanlış" />}
                <span className="min-w-0 flex-1 truncate text-fg">{p?.text ?? 'Soru'}</span>
                <span className="shrink-0 text-xs text-subtle lx-tabular">{(a.ms / 1000).toLocaleString('tr-TR', { maximumFractionDigits: 1 })} sn</span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button size="lg" icon={<RotateCcw className="size-4" />} onClick={onAgain} autoFocus className="min-w-44">
          Yeniden oyna
        </Button>
        {wrong > 0 && (
          <Button size="lg" variant="secondary" icon={<NotebookPen className="size-4" />} onClick={onOpenMistakes}>
            Hata defteri
          </Button>
        )}
        <Button size="lg" variant="ghost" onClick={onClose}>
          Kapat
        </Button>
      </div>
    </motion.section>
  );
}

export default function SpeedRound({ onFocusChange, onOpenMistakes }: { onFocusChange: (focus: boolean) => void; onOpenMistakes: () => void }) {
  const navigate = useNavigate();
  const lessons = useProgress((s) => s.lessons);
  const blocks = useProgress((s) => s.blocks);
  const poolSize = useMemo(() => speedRoundPool(useProgress.getState()).length, [lessons, blocks]);

  const [phase, setPhase] = useState<'intro' | 'run' | 'done'>('intro');
  const [items, setItems] = useState<PracticeItem[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [feedback, setFeedback] = useState<boolean | null>(null);
  const [deadline, setDeadline] = useState(0);
  const [left, setLeft] = useState(TOTAL_MS);
  const [frozen, setFrozen] = useState<number | null>(null);
  const [result, setResult] = useState<Finished | null>(null);
  const shownAt = useRef(0);
  const advanceTimer = useRef<number | undefined>(undefined);
  const ended = useRef(false);
  const answersRef = useRef<Answer[]>([]);
  answersRef.current = answers;
  useStudyClock(phase === 'run');

  useEffect(() => {
    onFocusChange(phase === 'run');
  }, [phase, onFocusChange]);
  useEffect(
    () => () => {
      onFocusChange(false);
      window.clearTimeout(advanceTimer.current);
    },
    [onFocusChange],
  );

  const finish = (all: Answer[], total: number, msLeft: number) => {
    if (ended.current) return;
    ended.current = true;
    window.clearTimeout(advanceTimer.current);
    const finishedAll = all.length >= total;
    const secondsLeft = msLeft / 1000;
    const correct = all.filter((a) => a.correct).length;
    const score = speedRoundScore(correct, secondsLeft, finishedAll);
    const previousBest = readLocal<SpeedBest | null>(BEST_KEY, null);
    const record = score.total > 0 && (!previousBest || score.total > previousBest.score);
    const at = new Date().toISOString();
    if (record) writeLocal(BEST_KEY, { score: score.total, correct, total, at } satisfies SpeedBest);
    writeLocal(HISTORY_KEY, [...readLocal<SpeedRun[]>(HISTORY_KEY, []), { score: score.total, correct, total, at }].slice(-12));
    setResult({ answers: all, total, secondsLeft, finishedAll, score, previousBest, record });
    setPhase('done');
  };

  // the clock
  useEffect(() => {
    if (phase !== 'run' || frozen !== null) return;
    const tick = () => {
      const l = Math.max(0, deadline - Date.now());
      setLeft(l);
      if (l <= 0) finish(answersRef.current, items.length, 0);
    };
    tick();
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [phase, deadline, frozen, items.length]);

  const start = () => {
    const set = speedRoundSet(useProgress.getState(), Date.now());
    if (set.length < SPEED_ROUND.minItems) return;
    window.clearTimeout(advanceTimer.current);
    ended.current = false;
    setItems(set);
    setIndex(0);
    setAnswers([]);
    setFeedback(null);
    setFrozen(null);
    setResult(null);
    const now = Date.now();
    shownAt.current = now;
    setDeadline(now + TOTAL_MS);
    setLeft(TOTAL_MS);
    setPhase('run');
  };

  const goNext = () => {
    window.clearTimeout(advanceTimer.current);
    if (ended.current) return;
    const all = answersRef.current;
    if (all.length >= items.length) {
      finish(all, items.length, frozen ?? left);
      return;
    }
    setFeedback(null);
    setIndex(all.length);
    shownAt.current = Date.now();
  };

  const onOutcome = (o: BlockOutcome) => {
    if (feedback !== null || ended.current) return;
    const item = items[index];
    if (!item) return;
    const now = Date.now();
    const all = [...answersRef.current, { id: item.id, correct: o.correct, ms: now - shownAt.current }];
    answersRef.current = all;
    setAnswers(all);
    setFeedback(o.correct);
    if (all.length >= items.length) setFrozen(Math.max(0, deadline - now)); // stop the clock: the bonus counts from here
    if (o.correct) advanceTimer.current = window.setTimeout(() => goNextRef.current(), 750);
  };
  const goNextRef = useRef(goNext);
  goNextRef.current = goNext;

  useHotkeys(phase === 'run' && feedback !== null ? { Enter: () => goNextRef.current() } : {}, phase === 'run');

  const abort = () => {
    window.clearTimeout(advanceTimer.current);
    ended.current = true;
    setPhase('intro');
  };

  if (phase === 'done' && result) {
    return <Results result={result} onAgain={start} onClose={() => setPhase('intro')} onOpenMistakes={onOpenMistakes} />;
  }

  if (phase === 'intro') {
    if (poolSize < SPEED_ROUND.minItems) {
      const next = getLesson(nextLessonId(useProgress.getState()) ?? '');
      return (
        <EmptyState
          mood="thinking"
          title="Hız turu için biraz daha soru gerekiyor"
          actions={
            next && (
              <Button icon={<BookOpen className="size-4" />} onClick={() => navigate(`/ders/${next.id}`)}>
                Derse başla
              </Button>
            )
          }
        >
          Hız turu, bitirdiğin derslerdeki çoktan seçmeli, “derlenir mi?” ve çıktı tahmini sorularından oluşur. En az{' '}
          {SPEED_ROUND.minItems} soru gerekiyor; bir ders daha bitirince açılır.
        </EmptyState>
      );
    }
    return <Intro poolSize={poolSize} onStart={start} />;
  }

  const item = items[index];
  const msLeft = frozen ?? left;
  const correctSoFar = answers.filter((a) => a.correct).length;
  let combo = 0;
  for (let i = answers.length - 1; i >= 0 && answers[i].correct; i--) combo++;
  const liveScore = correctSoFar * SPEED_ROUND.pointsPerCorrect;

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={abort}>
          Vazgeç
        </Button>
        <ol className="flex flex-1 items-center justify-center gap-1.5" aria-label={`${items.length} sorudan ${answers.length} tanesi cevaplandı`}>
          {items.map((it, i) => {
            const a = answers[i];
            return (
              <li
                key={`${it.id}-${i}`}
                className={clsx(
                  'size-2.5 rounded-full transition-colors',
                  a ? (a.correct ? 'bg-success' : 'bg-danger') : i === index ? 'bg-accent ring-4 ring-accent/20' : 'bg-border-strong',
                )}
              />
            );
          })}
        </ol>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {combo >= 3 && (
              <motion.span
                key="combo"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent"
              >
                <Flame className="size-3.5" aria-hidden /> {combo} üst üste
              </motion.span>
            )}
          </AnimatePresence>
          <span className="text-right">
            <span className="block text-[11px] font-medium text-muted">Puan</span>
            <AnimatedNumber value={liveScore} duration={0.5} className="block text-lg font-semibold leading-tight text-fg lx-tabular" />
          </span>
          <ProgressRing value={msLeft / TOTAL_MS} size={58} stroke={5} color={timerColor(msLeft)} label="Kalan süre">
            <span className={clsx('text-[13px] font-semibold lx-tabular', msLeft <= 10_000 ? 'text-danger' : 'text-fg')}>
              {formatClock(Math.ceil(msLeft / 1000))}
            </span>
          </ProgressRing>
        </div>
      </div>

      <div className="relative mt-7">
        <AnimatePresence mode="popLayout" initial={false}>
          {item && (
            <motion.div
              key={`${item.id}-${index}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            >
              <ItemSheet blockId={item.id} mode="review" onOutcome={onOutcome} eyebrow={`${index + 1}. soru`} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-5 flex min-h-12 items-center justify-center">
        {feedback === false && (
          <Button iconRight={<ArrowRight className="size-4" />} onClick={() => goNextRef.current()} autoFocus>
            {answers.length >= items.length ? 'Sonuçları gör' : 'Sonraki'} <Kbd>Enter</Kbd>
          </Button>
        )}
        {feedback === true && (
          <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 text-sm font-semibold text-success" role="status">
            <CheckCircle2 className="size-4" aria-hidden /> +{SPEED_ROUND.pointsPerCorrect}
          </motion.span>
        )}
        {feedback === null && (
          <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
            <Timer className="size-3.5" aria-hidden /> Süre işliyor; emin değilsen en iyi tahminini seç.
          </span>
        )}
      </div>
    </div>
  );
}
