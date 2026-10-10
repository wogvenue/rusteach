// "Isınma turu": up to three due spaced-repetition items from earlier lessons before new material
// (retrieval practice + interleaving). Checks are answered with the real block, cards are flipped
// and self-graded; both are graded in the FSRS deck.
import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Flame, SkipForward } from 'lucide-react';
import type { SrsEntry } from '../../store/progress';
import { useProgress } from '../../store/progress';
import { findBlock, findFlashcard } from '../../lib/content';
import { previewIntervals, type Grade } from '../../lib/srs';
import { xpToast } from '../../store/ui';
import { play } from '../../lib/sound';
import BlockRenderer from '../blocks/BlockRenderer';
import Html from '../blocks/Html';
import type { BlockOutcome } from '../blocks/types';
import { Button } from '../ui/Button';

const GRADES: { grade: Grade; label: string; tone: string }[] = [
  { grade: 1, label: 'Hatırlamadım', tone: 'border-danger/40 hover:bg-danger/8 text-danger' },
  { grade: 2, label: 'Zor', tone: 'border-warning/40 hover:bg-warning/8 text-warning' },
  { grade: 3, label: 'İyi', tone: 'border-success/40 hover:bg-success/8 text-success' },
  { grade: 4, label: 'Kolay', tone: 'border-info/40 hover:bg-info/8 text-info' },
];

function gradeFromOutcome(o: BlockOutcome): Grade {
  if (!o.correct) return 1;
  if (o.confidence === 1) return 2;
  if (o.confidence === 3) return 4;
  return 3;
}

function CardItem({ entry, onGraded }: { entry: SrsEntry; onGraded: () => void }) {
  const loc = findFlashcard(entry.id);
  const [shown, setShown] = useState(false);
  const intervals = useMemo(() => previewIntervals(entry.card), [entry.card]);
  if (!loc) return null;
  const grade = (g: Grade) => {
    xpToast(useProgress.getState().gradeCard(entry.id, g), 'Tekrar');
    onGraded();
  };
  return (
    <div className="block-card p-5">
      <div className="mb-2 text-xs font-semibold text-muted">Tekrar kartı: {loc.lesson.title}</div>
      <Html html={loc.card.front} className="font-medium" />
      {!shown ? (
        <Button
          className="mt-4"
          variant="secondary"
          onClick={() => {
            setShown(true);
            play('flip');
          }}
          autoFocus
        >
          Cevabı göster
        </Button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <div className="mt-4 rounded-2xl border border-accent/25 bg-accent/5 p-4">
            <Html html={loc.card.back} size="sm" />
          </div>
          <div className="mt-4 text-sm font-medium text-fg">Ne kadar kolay hatırladın?</div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {GRADES.map((g) => (
              <button
                key={g.grade}
                type="button"
                onClick={() => grade(g.grade)}
                className={`flex flex-col items-center rounded-xl border bg-surface px-3 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${g.tone}`}
              >
                {g.label}
                <span className="text-[0.7rem] font-medium text-subtle">{intervals[g.grade]}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

export default function WarmupPanel({ items, onDone }: { items: SrsEntry[]; onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [graded, setGraded] = useState(false);
  const entry = items[index];
  const last = index >= items.length - 1;

  const next = () => {
    if (last) return onDone();
    setGraded(false);
    setIndex((i) => i + 1);
  };

  const onCheck = (o: BlockOutcome) => {
    if (!entry) return;
    xpToast(useProgress.getState().gradeCard(entry.id, gradeFromOutcome(o)), 'Tekrar');
    setGraded(true);
  };

  if (!entry) return null;
  const loc = entry.kind === 'check' ? findBlock(entry.id) : undefined;

  return (
    <section aria-label="Isınma turu" className="mt-8">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-streak/15 text-streak">
          <Flame className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-fg">Isınma turu</div>
          <div className="text-xs text-muted">
            {index + 1}/{items.length}: önceki derslerden bir hatırlatma
          </div>
        </div>
        <Button variant="ghost" size="sm" icon={<SkipForward className="size-4" />} onClick={onDone}>
          Isınmayı atla
        </Button>
      </div>
      <div className="mb-4 flex gap-1.5" aria-hidden="true">
        {items.map((_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < index || (i === index && graded) ? 'bg-streak' : i === index ? 'bg-streak/40' : 'bg-surface-2'}`} />
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={entry.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
        >
          {entry.kind === 'check' && loc ? (
            <>
              <div className="mb-2 text-xs text-subtle">{loc.lesson.title} dersinden</div>
              <BlockRenderer block={loc.block} lessonId={loc.lesson.id} mode="review" fresh onComplete={onCheck} />
            </>
          ) : (
            <CardItem entry={entry} onGraded={next} />
          )}
        </motion.div>
      </AnimatePresence>
      {entry.kind === 'check' && graded && (
        <div className="mt-4 flex justify-end">
          <Button onClick={next} autoFocus>
            {last ? 'Derse geç' : 'Sonraki'}
          </Button>
        </div>
      )}
    </section>
  );
}
