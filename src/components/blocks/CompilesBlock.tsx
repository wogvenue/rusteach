// "Derlenir mi?" - borrow-checker intuition: the learner judges whether rustc accepts the code,
// then can ask the real compiler.
import { useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { Check, Hammer, ShieldQuestion, X } from 'lucide-react';
import type { CompilesBlock as CompilesBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import CodeView from '../editor/CodeView';
import RunOutput from '../editor/RunOutput';
import ErrorChip from '../editor/ErrorChip';
import { useRunner } from '../editor/useRunner';
import { ConfidencePicker, FeedbackPanel } from './CheckUi';
import { useCheckFlow } from './useCheckFlow';
import { useBlockHotkeys } from './hotkeys';

const CHOICES = [
  { value: true, label: 'Derlenir', hint: 'Derleyici bu kodu kabul eder', icon: Check, tone: 'success' },
  { value: false, label: 'Derlenmez', hint: 'Derleyici hata verir', icon: X, tone: 'danger' },
] as const;

export default function CompilesBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<CompilesBlockT>) {
  const flow = useCheckFlow<{ compiles: boolean }>({
    blockId: block.id,
    lessonId,
    mode,
    fresh,
    onComplete,
    allowRetry: false,
    askConfidence: true,
  });
  const runner = useRunner();
  const ref = useRef<HTMLElement>(null);
  const choice = flow.answer?.compiles;
  const locked = flow.phase === 'pending' || flow.phase === 'done';
  const evaluated = locked && flow.correct !== null;

  const choose = useCallback(
    (v: boolean) => {
      if (locked) return;
      flow.submit({ compiles: v }, v === block.answer);
    },
    [locked, flow, block.answer],
  );

  useBlockHotkeys(
    ref,
    () => flow.phase === 'answer' || flow.phase === 'confidence',
    (e) => {
      if (flow.phase === 'confidence' && /^[1-3]$/.test(e.key)) {
        flow.pickConfidence(Number(e.key) as 1 | 2 | 3);
        return true;
      }
      if (flow.phase !== 'answer') return false;
      if (e.key === '1') choose(true);
      else if (e.key === '2') choose(false);
      else return false;
      return true;
    },
  );

  const resultOf = (v: boolean): 'correct' | 'wrong' | 'dim' | undefined => {
    if (!evaluated) return undefined;
    if (v === block.answer) return 'correct';
    return v === choice ? 'wrong' : 'dim';
  };

  const ask = () => runner.run({ code: block.code, mode: 'compile', crates: block.crates });
  const frameState = evaluated ? (flow.correct ? 'correct' : 'incorrect') : flow.phase === 'confidence' ? 'active' : 'idle';

  return (
    <BlockFrame ref={ref} icon={<ShieldQuestion className="size-4" />} label="Derlenir mi?" state={frameState}>
      <Html html={block.question} className="font-medium" />
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--code-border)]">
        <CodeView code={block.display} ariaLabel="Değerlendirilecek kod" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3" role="radiogroup" aria-label="Bu kod derlenir mi?">
        {CHOICES.map((c, i) => {
          const res = resultOf(c.value);
          const isSel = choice === c.value && (flow.phase !== 'answer' || evaluated);
          const Icon = c.icon;
          return (
            <motion.button
              key={c.label}
              type="button"
              role="radio"
              aria-checked={isSel}
              disabled={locked}
              onClick={() => choose(c.value)}
              className="opt-card items-center gap-3 py-3.5"
              data-selected={!evaluated && isSel ? 'true' : undefined}
              data-result={res}
              initial={false}
              animate={
                res === 'wrong' ? { x: [0, -7, 6, -4, 3, 0], scale: 1 } : res === 'correct' && isSel ? { scale: [1, 1.02, 1], x: 0 } : { x: 0, scale: 1 }
              }
              transition={{ duration: 0.42, ease: 'easeOut' }}
            >
              <span
                className={clsx(
                  'grid size-9 shrink-0 place-items-center rounded-xl',
                  c.tone === 'success' ? 'bg-success-soft text-success' : 'bg-danger-soft text-danger',
                )}
                aria-hidden="true"
              >
                <Icon className="size-5" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{c.label}</span>
                <span className="block text-xs text-muted">{c.hint}</span>
              </span>
              {!locked && (
                <span className="kbd-hint hidden text-subtle sm:inline" aria-hidden="true">
                  {i + 1}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {flow.phase === 'confidence' && <ConfidencePicker onPick={flow.pickConfidence} onBack={flow.cancelConfidence} />}

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
        >
          {!block.answer && block.error && flow.revealed && (
            <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm text-muted">
              Derleyicinin vereceği hata:
              <ErrorChip code={block.error} />
              <span className="text-xs text-subtle">(açıklama için tıkla)</span>
            </p>
          )}
        </FeedbackPanel>
      )}

      {flow.revealed && mode !== 'boss' && (
        <div className="mt-4">
          {!runner.result && !runner.running ? (
            <button
              type="button"
              onClick={ask}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Hammer className="size-4 text-accent" /> Derleyiciye sor
            </button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--code-border)]">
              <RunOutput
                result={runner.result}
                running={runner.running}
                mode={runner.mode}
                startedAt={runner.startedAt}
                expect={block.answer ? undefined : 'compile_fail'}
                expectedError={block.error}
                onClose={runner.clear}
              />
            </div>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
