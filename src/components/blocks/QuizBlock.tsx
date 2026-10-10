// Multiple choice (single or multi-select) with confidence rating, per-option feedback and retry.
import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Check, CircleHelp, ListChecks, X } from 'lucide-react';
import type { QuizBlock as QuizBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import { ConfidencePicker, FeedbackPanel } from './CheckUi';
import { useCheckFlow } from './useCheckFlow';
import { keyIndex, useBlockHotkeys } from './hotkeys';

const LETTERS = 'ABCDEFGHI';

function sameSet(a: number[], b: number[]) {
  return a.length === b.length && a.every((x) => b.includes(x));
}

export default function QuizBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<QuizBlockT>) {
  const flow = useCheckFlow<{ selected: number[] }>({
    blockId: block.id,
    lessonId,
    mode,
    fresh,
    onComplete,
    allowRetry: block.options.length > 2,
    askConfidence: true,
  });
  const [selected, setSelected] = useState<number[]>(() => flow.answer?.selected ?? []);
  const ref = useRef<HTMLElement>(null);

  const locked = flow.phase === 'pending' || flow.phase === 'done';
  const evaluated = locked && flow.correct !== null;

  const choose = useCallback(
    (i: number) => {
      if (locked || i < 0 || i >= block.options.length) return;
      if (block.multi) {
        setSelected((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i].sort()));
        if (flow.phase === 'confidence') flow.cancelConfidence();
        return;
      }
      setSelected([i]);
      flow.submit({ selected: [i] }, block.answer.includes(i));
    },
    [locked, block, flow],
  );

  const check = useCallback(() => {
    if (!selected.length || locked) return;
    flow.submit({ selected }, sameSet(selected, block.answer));
  }, [selected, locked, flow, block.answer]);

  const retry = () => {
    setSelected([]);
    flow.retry();
  };

  useBlockHotkeys(
    ref,
    () => flow.phase === 'answer' || flow.phase === 'confidence',
    (e) => {
      if (flow.phase === 'confidence' && /^[1-3]$/.test(e.key)) {
        flow.pickConfidence(Number(e.key) as 1 | 2 | 3);
        return true;
      }
      if (flow.phase !== 'answer' && !(block.multi && flow.phase === 'confidence')) return false;
      if (e.key === 'Enter' && block.multi && selected.length) {
        check();
        return true;
      }
      const i = keyIndex(e);
      if (i >= 0 && i < block.options.length) {
        choose(i);
        return true;
      }
      return false;
    },
  );

  const optionResult = (i: number): 'correct' | 'wrong' | 'dim' | undefined => {
    if (!evaluated) return undefined;
    const isAns = block.answer.includes(i);
    const isSel = selected.includes(i);
    if (flow.revealed) {
      if (isAns) return 'correct';
      if (isSel) return 'wrong';
      return 'dim';
    }
    // pending (wrong, not revealed): only mark the learner's wrong picks
    if (isSel && !isAns) return 'wrong';
    if (isSel && isAns) return 'correct';
    return undefined;
  };

  const frameState = evaluated ? (flow.correct ? 'correct' : 'incorrect') : flow.phase === 'confidence' ? 'active' : 'idle';

  return (
    <BlockFrame
      ref={ref}
      icon={block.multi ? <ListChecks className="size-4" /> : <CircleHelp className="size-4" />}
      label={block.multi ? 'Çoklu seçim' : 'Soru'}
      state={frameState}
    >
      <Html html={block.question} className="font-medium" />
      {block.multi && !locked && (
        <p className="mt-1 text-xs text-muted">Doğru olan tüm seçenekleri işaretle, sonra “Kontrol et”e bas.</p>
      )}
      <div className="mt-4 grid gap-2.5" role={block.multi ? 'group' : 'radiogroup'} aria-label="Seçenekler">
        {block.options.map((opt, i) => {
          const res = optionResult(i);
          const isSel = selected.includes(i);
          const fb = block.feedback?.[i];
          const showFb = !!fb && evaluated && (flow.revealed || (isSel && res === 'wrong'));
          return (
            <motion.button
              key={i}
              type="button"
              role={block.multi ? 'checkbox' : 'radio'}
              aria-checked={isSel}
              disabled={locked}
              onClick={() => choose(i)}
              className="opt-card"
              data-selected={!evaluated && isSel ? 'true' : undefined}
              data-result={res}
              initial={false}
              animate={
                res === 'wrong' && isSel
                  ? { x: [0, -7, 6, -4, 3, 0], scale: 1 }
                  : res === 'correct' && isSel
                    ? { scale: [1, 1.018, 1], x: 0 }
                    : { x: 0, scale: 1 }
              }
              transition={{ duration: 0.42, ease: 'easeOut' }}
            >
              <span className="opt-letter" aria-hidden="true">
                {res === 'correct' ? <Check className="size-3.5" /> : res === 'wrong' ? <X className="size-3.5" /> : LETTERS[i]}
              </span>
              <span className="min-w-0 flex-1">
                <Html as="span" html={opt} className="block" size="sm" />
                {showFb && (
                  <motion.span
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className={clsx('mt-1.5 block text-[0.84rem] leading-relaxed', res === 'wrong' ? 'text-danger' : 'text-muted')}
                  >
                    <Html as="span" html={fb!} prose={false} />
                  </motion.span>
                )}
              </span>
              {!locked && (
                <span className="kbd-hint mt-0.5 hidden self-start text-subtle sm:inline" aria-hidden="true">
                  {i + 1}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {block.multi && !locked && flow.phase === 'answer' && (
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={check}
            disabled={!selected.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Kontrol et
          </button>
          <span className="text-xs text-muted">{selected.length} seçili</span>
        </div>
      )}

      {flow.phase === 'confidence' && (
        <ConfidencePicker onPick={flow.pickConfidence} onBack={block.multi ? flow.cancelConfidence : undefined} />
      )}

      {evaluated && (
        <FeedbackPanel
          key={flow.pulse}
          correct={!!flow.correct}
          revealed={flow.revealed}
          explanation={block.explanation}
          xp={flow.xp}
          confidence={flow.confidence}
          mode={mode}
          seed={`${block.id}-${flow.attempts}`}
          onRetry={flow.phase === 'pending' ? retry : undefined}
          onReveal={flow.phase === 'pending' ? flow.reveal : undefined}
          pendingText={
            block.multi
              ? 'Seçimlerinden bazıları yanlış ya da eksik. Yeniden denemek ister misin?'
              : undefined
          }
        />
      )}
    </BlockFrame>
  );
}
