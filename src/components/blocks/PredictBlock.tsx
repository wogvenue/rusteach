// "Bu kod ne yazdırır?" - predict the output (options or free text), then really run the code.
import { useCallback, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Play, ScanEye, X } from 'lucide-react';
import type { PredictBlock as PredictBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import CodeView from '../editor/CodeView';
import RunOutput from '../editor/RunOutput';
import { useRunner } from '../editor/useRunner';
import { normalizeOutput } from '../../lib/runner';
import { ConfidencePicker, FeedbackPanel } from './CheckUi';
import { useCheckFlow } from './useCheckFlow';
import { keyIndex, useBlockHotkeys } from './hotkeys';

const LETTERS = 'ABCDEFGHI';

type Answer = { choice?: number; text?: string };

export default function PredictBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<PredictBlockT>) {
  const hasOptions = !!block.options?.length;
  const flow = useCheckFlow<Answer>({
    blockId: block.id,
    lessonId,
    mode,
    fresh,
    onComplete,
    allowRetry: hasOptions ? block.options!.length > 2 : true,
    askConfidence: true,
  });
  const [choice, setChoice] = useState<number | undefined>(() => flow.answer?.choice);
  const [text, setText] = useState(() => flow.answer?.text ?? '');
  const runner = useRunner();
  const ref = useRef<HTMLElement>(null);

  const locked = flow.phase === 'pending' || flow.phase === 'done';
  const evaluated = locked && flow.correct !== null;

  const choose = useCallback(
    (i: number) => {
      if (locked || !hasOptions || i < 0 || i >= block.options!.length) return;
      setChoice(i);
      flow.submit({ choice: i }, i === block.answer);
    },
    [locked, hasOptions, block, flow],
  );

  const checkText = useCallback(() => {
    if (locked || !text.trim()) return;
    flow.submit({ text }, normalizeOutput(text) === normalizeOutput(block.output ?? ''));
  }, [locked, text, flow, block.output]);

  const retry = () => {
    setChoice(undefined);
    flow.retry();
  };

  useBlockHotkeys(
    ref,
    () => hasOptions && (flow.phase === 'answer' || flow.phase === 'confidence'),
    (e) => {
      if (flow.phase === 'confidence' && /^[1-3]$/.test(e.key)) {
        flow.pickConfidence(Number(e.key) as 1 | 2 | 3);
        return true;
      }
      if (flow.phase !== 'answer' || !hasOptions) return false;
      const i = keyIndex(e);
      if (i >= 0 && i < block.options!.length) {
        choose(i);
        return true;
      }
      return false;
    },
  );

  const optionResult = (i: number): 'correct' | 'wrong' | 'dim' | undefined => {
    if (!evaluated) return undefined;
    if (flow.revealed) return i === block.answer ? 'correct' : i === choice ? 'wrong' : 'dim';
    return i === choice ? (i === block.answer ? 'correct' : 'wrong') : undefined;
  };

  const runIt = () => runner.run({ code: block.code, mode: 'run', crates: block.crates });
  const frameState = evaluated ? (flow.correct ? 'correct' : 'incorrect') : flow.phase === 'confidence' ? 'active' : 'idle';

  return (
    <BlockFrame ref={ref} icon={<ScanEye className="size-4" />} label="Tahmin et" state={frameState}>
      <Html html={block.question} className="font-medium" />
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--code-border)]">
        <CodeView code={block.display} ariaLabel="Tahmin edilecek kod" />
      </div>

      {hasOptions ? (
        <>
          <p className="mt-4 mb-2 text-xs font-medium text-muted">Programın çıktısı hangisi?</p>
          <div className="grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Çıktı seçenekleri">
            {block.options!.map((opt, i) => {
              const res = optionResult(i);
              const isSel = choice === i;
              return (
                <motion.button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={isSel}
                  disabled={locked}
                  onClick={() => choose(i)}
                  className="opt-card items-start"
                  data-selected={!evaluated && isSel ? 'true' : undefined}
                  data-result={res}
                  initial={false}
                  animate={
                    res === 'wrong' && isSel
                      ? { x: [0, -7, 6, -4, 3, 0], scale: 1 }
                      : res === 'correct' && isSel
                        ? { scale: [1, 1.02, 1], x: 0 }
                        : { x: 0, scale: 1 }
                  }
                  transition={{ duration: 0.42, ease: 'easeOut' }}
                >
                  <span className="opt-letter" aria-hidden="true">
                    {res === 'correct' ? <Check className="size-3.5" /> : res === 'wrong' ? <X className="size-3.5" /> : LETTERS[i]}
                  </span>
                  <span className="opt-mono min-w-0 flex-1 pt-0.5">{opt === '' ? '(boş çıktı)' : opt}</span>
                </motion.button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mt-4">
          <label htmlFor={`${block.id}-out`} className="mb-2 block text-xs font-medium text-muted">
            Programın ekrana yazdıracağı çıktıyı satır satır yaz:
          </label>
          <textarea
            id={`${block.id}-out`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                checkText();
              }
            }}
            readOnly={locked}
            rows={Math.min(8, Math.max(2, (block.output ?? '').split('\n').length + 1))}
            spellCheck={false}
            className="lesson-textarea font-mono text-sm"
            placeholder="Çıktı…"
          />
          {flow.phase === 'answer' && (
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={checkText}
                disabled={!text.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                Kontrol et
              </button>
              <span className="kbd-only text-xs text-muted">
                <span className="kbd-hint">Ctrl</span> + <span className="kbd-hint">Enter</span>
              </span>
            </div>
          )}
        </div>
      )}

      {flow.phase === 'confidence' && (
        <ConfidencePicker onPick={flow.pickConfidence} onBack={!hasOptions ? flow.cancelConfidence : undefined} />
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
          pendingText={!hasOptions ? 'Çıktın beklenenle aynı değil. Kodu satır satır yeniden izlemek ister misin?' : undefined}
        >
          {flow.revealed && !hasOptions && !flow.correct && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-muted">Doğru çıktı</div>
              <pre className="rounded-xl border border-[var(--code-border)] bg-[var(--code-bg)] px-3 py-2 font-mono text-sm text-[var(--code-fg)]">
                {block.output}
              </pre>
            </div>
          )}
        </FeedbackPanel>
      )}

      {flow.revealed && mode !== 'boss' && (
        <div className="mt-4">
          {!runner.result && !runner.running ? (
            <button
              type="button"
              onClick={runIt}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Play className="size-4 text-accent" /> Çalıştır ve gör
            </button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--code-border)]">
              <RunOutput
                result={runner.result}
                running={runner.running}
                mode={runner.mode}
                startedAt={runner.startedAt}
                onClose={runner.clear}
              />
            </div>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
