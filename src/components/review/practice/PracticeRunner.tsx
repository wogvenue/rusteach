// Runs a list of practice items (karma antrenman, hata defteri turu) one at a time with the lesson
// player's blocks in practice mode. After each item a short verdict; a failed check comes back once
// a few items later (successive relearning); a first-try correct answer closes its open mistake.
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Eye, SkipForward, XCircle } from 'lucide-react';
import clsx from 'clsx';
import { useProgress } from '../../../store/progress';
import { requeueIndex, type PracticeItem } from '../../../lib/practice';
import type { BlockOutcome } from '../../blocks/types';
import { Button } from '../../ui/Button';
import { Kbd } from '../../ui/primitives';
import ItemSheet from '../ItemSheet';
import SessionHeader from '../SessionHeader';
import { useHotkeys, useStudyClock } from '../shared/hooks';
import PracticeSummary, { type PracticeOutcome, type PracticeResult } from './PracticeSummary';

const MAX_REQUEUE = 1;

interface QueueItem {
  key: string;
  item: PracticeItem;
  repeat: number;
}

interface Verdict {
  outcome: PracticeOutcome;
  resolved: boolean;
  requeued: boolean;
}

function classify(o: BlockOutcome, item: PracticeItem): PracticeOutcome {
  if (o.correct) return 'correct';
  if (o.revealedSolution) return 'revealed';
  if (item.kind === 'check' && useProgress.getState().blocks[item.id]?.correct) return 'second';
  return item.kind === 'exercise' ? 'revealed' : 'wrong';
}

function verdictText(v: Verdict, item: PracticeItem, repeat: number): { title: string; text: string } {
  switch (v.outcome) {
    case 'correct':
      return {
        title: 'Doğru!',
        text: v.resolved
          ? 'Bu soru hata defterinden çıktı.'
          : repeat > 0
            ? 'Bu kez hatırladın. Birkaç gün sonra yeniden sorulduğunda kalıcı olacak.'
            : item.reasons[0]
              ? `Seçilme nedeni: ${item.reasons[0]}`
              : 'Güzel, devam.',
      };
    case 'second':
      return {
        title: 'İkinci denemede buldun',
        text: v.requeued ? 'Pekişsin diye birazdan bir kez daha gelecek.' : 'Hata defterinde kalıyor; birkaç gün sonra yeniden dene.',
      };
    case 'revealed':
      return {
        title: item.kind === 'exercise' ? 'Çözümü inceledin' : 'Cevabı gördün',
        text:
          item.kind === 'exercise'
            ? 'Yarın bu alıştırmayı çözüme bakmadan baştan yazmayı dene; katalogda seni bekliyor.'
            : v.requeued
              ? 'Açıklamayı oku; soru birazdan yeniden gelecek.'
              : 'Hata defterine eklendi; birkaç gün sonra yeniden dene.',
      };
    default:
      return {
        title: 'Bu sefer olmadı',
        text: v.requeued ? 'Açıklamayı oku; soru birazdan yeniden gelecek.' : 'Hata defterine eklendi; birkaç gün sonra yeniden dene.',
      };
  }
}

export default function PracticeRunner({
  items,
  onClose,
  onRestart,
  restartLabel,
  onOpenMistakes,
}: {
  items: PracticeItem[];
  onClose: () => void;
  onRestart?: () => void;
  restartLabel?: string;
  onOpenMistakes?: () => void;
}) {
  const [queue, setQueue] = useState<QueueItem[]>(() => items.map((item) => ({ key: `${item.id}#0`, item, repeat: 0 })));
  const queueRef = useRef(queue);
  const [index, setIndex] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [results, setResults] = useState<PracticeResult[]>([]);
  const [phase, setPhase] = useState<'run' | 'done'>('run');
  const [startedAt] = useState(() => Date.now());
  const [endedAt, setEndedAt] = useState<number | null>(null);
  const [burst, setBurst] = useState<{ id: number; amount: number } | null>(null);
  const startXp = useRef(useProgress.getState().xp);
  const xpNow = useProgress((s) => s.xp);
  const lastXp = useRef(xpNow);
  const busy = useRef(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  useStudyClock(phase === 'run');

  // Blocks award their own XP; show it as a burst on the session counter.
  useEffect(() => {
    const gained = xpNow - lastXp.current;
    lastXp.current = xpNow;
    if (gained > 0) setBurst({ id: Date.now(), amount: gained });
  }, [xpNow]);

  useEffect(() => {
    busy.current = false;
  }, [index, phase]);

  useEffect(() => {
    if (verdict) continueRef.current?.focus({ preventScroll: true });
  }, [verdict]);

  const current = queue[index];

  const setQueueBoth = (q: QueueItem[]) => {
    queueRef.current = q;
    setQueue(q);
  };

  const finish = () => {
    setEndedAt(Date.now());
    setPhase('done');
  };

  const advance = () => {
    setVerdict(null);
    if (index + 1 >= queueRef.current.length) finish();
    else setIndex(index + 1);
  };

  const onOutcome = (o: BlockOutcome) => {
    if (!current || verdict) return;
    const outcome = classify(o, current.item);
    let resolved = false;
    if (outcome === 'correct' && current.repeat === 0) {
      const m = useProgress.getState().mistakes[current.item.id];
      if (m && !m.resolved) {
        useProgress.getState().resolveMistake(current.item.id);
        resolved = true;
      }
    }
    let requeued = false;
    if (outcome !== 'correct' && current.item.kind === 'check' && current.repeat < MAX_REQUEUE) {
      const q = queueRef.current;
      const pos = requeueIndex(q, index, current, (x) => x.item.lessonId);
      setQueueBoth([...q.slice(0, pos), { key: `${current.item.id}#${current.repeat + 1}`, item: current.item, repeat: current.repeat + 1 }, ...q.slice(pos)]);
      requeued = true;
    }
    setResults((r) => [...r, { item: current.item, outcome, repeat: current.repeat, resolvedMistake: resolved }]);
    setVerdict({ outcome, resolved, requeued });
  };

  const next = () => {
    if (busy.current) return;
    busy.current = true;
    advance();
  };

  const skip = () => {
    if (busy.current || !current || verdict) return;
    busy.current = true;
    setResults((r) => [...r, { item: current.item, outcome: 'skipped', repeat: current.repeat, resolvedMistake: false }]);
    advance();
  };

  const exit = () => {
    if (!results.length) onClose();
    else finish();
  };

  useHotkeys(verdict ? { Enter: next } : {}, phase === 'run');

  if (phase === 'done') {
    return (
      <PracticeSummary
        results={results}
        seconds={Math.round(((endedAt ?? Date.now()) - startedAt) / 1000)}
        xp={xpNow - startXp.current}
        onClose={onClose}
        onRestart={onRestart}
        restartLabel={restartLabel}
        onOpenMistakes={onOpenMistakes}
      />
    );
  }
  if (!current) return null;

  const text = verdict ? verdictText(verdict, current.item, current.repeat) : null;
  const good = verdict?.outcome === 'correct';
  const VerdictIcon = good ? CheckCircle2 : verdict?.outcome === 'revealed' ? Eye : verdict?.outcome === 'second' ? CheckCircle2 : XCircle;

  return (
    <div className="mx-auto w-full max-w-[860px]">
      <SessionHeader
        done={index}
        total={queue.length}
        xp={xpNow - startXp.current}
        burst={burst}
        startedAt={startedAt}
        onExit={exit}
        exitLabel={results.length ? 'Bitir' : 'Vazgeç'}
      />

      <div className="relative mt-7">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={current.key}
            initial={{ opacity: 0, y: 22, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: -60, scale: 0.98, transition: { duration: 0.25 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative"
          >
            {current.repeat > 0 && (
              <div className="absolute -top-3 left-6 z-10 rounded-full border border-warning/40 bg-warning-soft px-2.5 py-0.5 text-xs font-semibold text-warning backdrop-blur">
                Bir kez daha
              </div>
            )}
            <ItemSheet blockId={current.item.id} mode="practice" onOutcome={onOutcome} reasons={current.repeat ? [] : current.item.reasons} />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 min-h-[76px]">
        {verdict && text ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            role="status"
            className={clsx(
              'flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3',
              good
                ? 'border-success/30 bg-success-soft'
                : verdict.outcome === 'second'
                  ? 'border-warning/30 bg-warning-soft'
                  : verdict.outcome === 'revealed'
                    ? 'border-info/30 bg-info-soft'
                    : 'border-danger/30 bg-danger-soft',
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              <VerdictIcon
                className={clsx(
                  'size-5 shrink-0',
                  good ? 'text-success' : verdict.outcome === 'second' ? 'text-warning' : verdict.outcome === 'revealed' ? 'text-info' : 'text-danger',
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-fg">{text.title}</div>
                <div className="text-xs text-muted">{text.text}</div>
              </div>
            </div>
            <Button ref={continueRef} iconRight={<ArrowRight className="size-4" />} onClick={next}>
              {index + 1 >= queue.length ? 'Bitir' : 'Devam'} <Kbd>Enter</Kbd>
            </Button>
          </motion.div>
        ) : (
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" icon={<SkipForward className="size-4" />} onClick={skip}>
              Bu soruyu geç
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
