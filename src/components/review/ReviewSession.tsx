// A running spaced-repetition session: interleaved queue, flashcards with a 3D flip and FSRS grades,
// resurfaced checks rendered by the lesson player, successive relearning of failed items, then a summary.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, PauseCircle, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useProgress, type SrsEntry, type SrsKind } from '../../store/progress';
import { findBlock, findFlashcard } from '../../lib/content';
import { buildReviewQueue, requeueIndex } from '../../lib/practice';
import { cardStage, formatDue, previewIntervals, type Grade } from '../../lib/srs';
import { play } from '../../lib/sound';
import { toast } from '../../store/ui';
import type { BlockOutcome } from '../blocks/types';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/primitives';
import FlashcardView from './FlashcardView';
import GradeButtons, { GRADE_META } from './GradeButtons';
import ItemSheet from './ItemSheet';
import SessionHeader from './SessionHeader';
import ReviewSummary, { type ReviewResult } from './ReviewSummary';
import { useHotkeys, useStudyClock } from './shared/hooks';

/** A failed item comes back once more in the same session (successive relearning). */
const MAX_REQUEUE = 1;

interface QueueItem {
  key: string;
  entryId: string;
  repeat: number;
}

/** Check outcome → FSRS grade (wrong → Tekrar; lucky guess → Zor; sure and right → Kolay). */
export function gradeFromOutcome(o: BlockOutcome): Grade {
  if (!o.correct) return 1;
  if (o.confidence === 1) return 2;
  if (o.confidence === 3) return 4;
  return 3;
}

const cardVariants = {
  enter: { opacity: 0, y: 26, scale: 0.96 },
  center: { opacity: 1, y: 0, scale: 1, x: 0, rotate: 0 },
  exit: (g: Grade) => ({
    opacity: 0,
    x: g === 1 ? -150 : g === 2 ? -80 : g === 3 ? 90 : 160,
    rotate: g <= 2 ? -5 : 5,
    scale: 0.98,
    transition: { duration: 0.32, ease: [0.4, 0, 0.2, 1] as const },
  }),
};

export default function ReviewSession({ entries, onClose, onMore }: { entries: SrsEntry[]; onClose: () => void; onMore: () => void }) {
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    buildReviewQueue(entries, 'all', Date.now()).map((e) => ({ key: `${e.id}#0`, entryId: e.id, repeat: 0 })),
  );
  const queueRef = useRef(queue);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [checkResult, setCheckResult] = useState<{ grade: Grade; correct: boolean } | null>(null);
  const [results, setResults] = useState<ReviewResult[]>([]);
  const [phase, setPhase] = useState<'run' | 'done'>('run');
  const [exitGrade, setExitGrade] = useState<Grade>(3);
  const [burst, setBurst] = useState<{ id: number; amount: number } | null>(null);
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const startXp = useRef(useProgress.getState().xp);
  const busy = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);

  const srs = useProgress((s) => s.srs);
  const xpNow = useProgress((s) => s.xp);
  useStudyClock(phase === 'run');

  const item = queue[index];
  const entry: SrsEntry | undefined = item ? srs[item.entryId] : undefined;
  const isFlash = entry?.kind === 'flashcard';
  const flash = isFlash && entry ? findFlashcard(entry.id) : undefined;
  const intervals = useMemo(() => (entry && revealed ? previewIntervals(entry.card) : null), [entry, revealed]);

  useEffect(() => {
    busy.current = false;
  }, [index, phase]);

  useEffect(() => {
    if (checkResult) continueRef.current?.focus({ preventScroll: true });
  }, [checkResult]);

  const setQueueBoth = (q: QueueItem[]) => {
    queueRef.current = q;
    setQueue(q);
  };

  const finish = () => {
    setEndedAt(Date.now());
    setPhase('done');
  };

  const advance = () => {
    setRevealed(false);
    setCheckResult(null);
    if (index + 1 >= queueRef.current.length) finish();
    else setIndex(index + 1);
  };

  const applyGrade = (g: Grade, kind: SrsKind) => {
    if (!item) return;
    const xp = useProgress.getState().gradeCard(item.entryId, g);
    setResults((r) => [...r, { entryId: item.entryId, kind, grade: g, repeat: item.repeat }]);
    if (xp > 0) setBurst({ id: Date.now(), amount: xp });
    if (g === 1 && item.repeat < MAX_REQUEUE) {
      const q = queueRef.current;
      const lessonOf = (x: QueueItem) => useProgress.getState().srs[x.entryId]?.lessonId ?? x.entryId;
      const pos = requeueIndex(q, index, item, lessonOf);
      setQueueBoth([...q.slice(0, pos), { key: `${item.entryId}#${item.repeat + 1}`, entryId: item.entryId, repeat: item.repeat + 1 }, ...q.slice(pos)]);
    }
  };

  const reveal = () => {
    if (!isFlash || revealed) return;
    setRevealed(true);
    play('flip');
  };

  const gradeFlashcard = (g: Grade) => {
    if (!isFlash || !revealed || busy.current) return;
    busy.current = true;
    play('click');
    setExitGrade(g);
    applyGrade(g, 'flashcard');
    advance();
  };

  const onCheckOutcome = (o: BlockOutcome) => {
    if (!entry || checkResult) return;
    const g = gradeFromOutcome(o);
    applyGrade(g, 'check');
    if (o.correct) useProgress.getState().resolveMistake(entry.id);
    setCheckResult({ grade: g, correct: o.correct });
  };

  const continueCheck = () => {
    if (!checkResult || busy.current) return;
    busy.current = true;
    setExitGrade(checkResult.grade);
    advance();
  };

  const skipItem = () => {
    if (busy.current || !item) return;
    busy.current = true;
    setExitGrade(2);
    // keep it due: move it to the end once, otherwise drop it from this session
    if (item.repeat < MAX_REQUEUE && index + 1 < queueRef.current.length) {
      setQueueBoth([...queueRef.current, { ...item, key: `${item.entryId}#skip`, repeat: MAX_REQUEUE }]);
    }
    advance();
  };

  const suspendCurrent = () => {
    if (!entry || busy.current) return;
    busy.current = true;
    useProgress.getState().suspendCard(entry.id, true);
    const q = queueRef.current;
    const rest = q.slice(index + 1).filter((x) => x.entryId !== entry.id);
    setQueueBoth([...q.slice(0, index + 1), ...rest]);
    toast({ kind: 'info', title: 'Kart askıya alındı', description: 'Kart tarayıcısından istediğin zaman geri açabilirsin.' });
    setExitGrade(2);
    advance();
  };

  const exit = () => {
    if (!results.length) onClose();
    else finish();
  };

  // Only the keys that apply right now: a resurfaced check uses number keys for its own options.
  useHotkeys(
    isFlash
      ? revealed
        ? { '1': () => gradeFlashcard(1), '2': () => gradeFlashcard(2), '3': () => gradeFlashcard(3), '4': () => gradeFlashcard(4) }
        : { ' ': reveal, Enter: reveal }
      : checkResult
        ? { Enter: continueCheck }
        : {},
    phase === 'run',
  );

  if (phase === 'done') {
    return (
      <ReviewSummary
        results={results}
        seconds={Math.round(((endedAt ?? Date.now()) - startedAt) / 1000)}
        xp={xpNow - startXp.current}
        onClose={onClose}
        onMore={onMore}
      />
    );
  }

  if (!item || !entry) {
    return null;
  }

  const remaining = queue.length - index;
  const nextDue = checkResult ? formatDue(entry.card) : null;
  const check = !isFlash ? findBlock(entry.id) : undefined;

  return (
    <div className="mx-auto w-full max-w-[760px]">
      <SessionHeader
        done={index}
        total={queue.length}
        xp={xpNow - startXp.current}
        burst={burst}
        startedAt={startedAt}
        onExit={exit}
        exitLabel={results.length ? 'Bitir' : 'Vazgeç'}
      />

      <div className="relative mt-8">
        {remaining > 1 && (
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className={clsx('absolute inset-x-6 -bottom-3 border border-border bg-surface/80', isFlash ? 'top-6 rounded-[28px]' : 'top-14 rounded-[18px]')} />
            {remaining > 2 && (
              <div className={clsx('absolute inset-x-12 -bottom-6 border border-border bg-surface/50', isFlash ? 'top-12 rounded-[28px]' : 'top-20 rounded-[18px]')} />
            )}
          </div>
        )}
        <AnimatePresence mode="popLayout" custom={exitGrade} initial={false}>
          <motion.div
            key={item.key}
            custom={exitGrade}
            variants={cardVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative"
          >
            {item.repeat > 0 && (
              <div className="absolute -top-3 left-6 z-10 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning backdrop-blur">
                Bir kez daha
              </div>
            )}
            {isFlash && flash ? (
              <FlashcardView
                front={flash.card.front}
                back={flash.card.back}
                module={flash.module}
                lessonTitle={flash.lesson.title}
                stage={cardStage(entry.card)}
                revealed={revealed}
                onReveal={reveal}
              />
            ) : check ? (
              <ItemSheet blockId={entry.id} mode="review" onOutcome={onCheckOutcome} eyebrow="Soru tekrarı" />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-8 min-h-[104px]">
        {isFlash && !revealed && (
          <div className="flex flex-col items-center gap-3">
            <Button size="lg" icon={<Eye className="size-4" />} onClick={reveal} className="min-w-64">
              Cevabı göster
            </Button>
            <span className="text-xs text-subtle">
              <Kbd>Boşluk</Kbd> tuşu da çevirir
            </span>
          </div>
        )}
        {isFlash && revealed && intervals && <GradeButtons intervals={intervals} onGrade={gradeFlashcard} />}
        {!isFlash && checkResult && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
              'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3',
              checkResult.correct ? 'border-success/30 bg-success-soft' : 'border-danger/30 bg-danger-soft',
            )}
            role="status"
          >
            <div className="flex items-center gap-3">
              {checkResult.correct ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <XCircle className="size-5 text-danger" aria-hidden />}
              <div>
                <div className="text-sm font-semibold text-fg">
                  {checkResult.correct ? 'Doğru! ' : 'Bu sefer olmadı. '}
                  <span className="font-medium text-muted">“{GRADE_META[checkResult.grade].label}” olarak işaretlendi</span>
                </div>
                <div className="text-xs text-muted">
                  {checkResult.correct
                    ? `Sonraki tekrar: ${nextDue}`
                    : item.repeat < MAX_REQUEUE
                      ? 'Açıklamayı oku; bu soru birazdan bir kez daha gelecek.'
                      : 'Açıklamayı oku; bu soru yakında yeniden karşına çıkacak.'}
                </div>
              </div>
            </div>
            <Button ref={continueRef} iconRight={<ArrowRight className="size-4" />} onClick={continueCheck}>
              Devam <Kbd>Enter</Kbd>
            </Button>
          </motion.div>
        )}
        {!isFlash && !checkResult && (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" onClick={skipItem}>
              Bu soruyu şimdilik geç
            </Button>
          </div>
        )}
      </div>

      {isFlash && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={suspendCurrent}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-subtle outline-none transition-colors hover:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          >
            <PauseCircle className="size-3.5" aria-hidden /> Bu kartı askıya al
          </button>
        </div>
      )}
    </div>
  );
}
