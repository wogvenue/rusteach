// Fill in the blanks (faded worked example): inline inputs inside highlighted code.
// Answers compare after removing all whitespace; after two wrong checks the answer is revealed.
import { useCallback, useRef, useState } from 'react';
import { ArrowRight, PencilLine, Play } from 'lucide-react';
import type { FillBlock as FillBlockT } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import CodeView from '../editor/CodeView';
import RunOutput from '../editor/RunOutput';
import { useRunner } from '../editor/useRunner';
import { hasMain } from '../../lib/runner';
import { ConfidencePicker, FeedbackPanel } from './CheckUi';
import { useCheckFlow } from './useCheckFlow';

type Answer = { values: string[] };

const squash = (s: string) => s.replace(/\s+/g, '');

function gradeValues(values: string[], blanks: string[][]): boolean[] {
  return blanks.map((accepted, i) => accepted.some((a) => squash(a) === squash(values[i] ?? '')));
}

export default function FillBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<FillBlockT>) {
  const flow = useCheckFlow<Answer>({
    blockId: block.id,
    lessonId,
    mode,
    fresh,
    onComplete,
    allowRetry: true,
    askConfidence: true,
  });
  const count = block.blanks.length;
  const [values, setValues] = useState<string[]>(() =>
    Array.from({ length: count }, (_, i) => flow.answer?.values?.[i] ?? ''),
  );
  const [marks, setMarks] = useState<(boolean | undefined)[]>(() =>
    flow.restored && flow.answer?.values ? gradeValues(flow.answer.values, block.blanks) : [],
  );
  const [emptyWarn, setEmptyWarn] = useState(false);
  const lastChecked = useRef<string | null>(flow.restored ? JSON.stringify(values) : null);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const runner = useRunner();

  const readOnly = flow.phase === 'done' || flow.phase === 'confidence';
  const evaluated = (flow.phase === 'pending' || flow.phase === 'done') && flow.correct !== null;
  const showMarks = flow.phase !== 'confidence' && (flow.attempts > 0 || flow.restored);

  const focusBlank = (i: number) => inputs.current[i]?.focus();

  const check = useCallback(() => {
    if (readOnly) return;
    const empty = values.findIndex((v) => !v.trim());
    if (empty >= 0) {
      setEmptyWarn(true);
      focusBlank(empty);
      return;
    }
    const key = JSON.stringify(values);
    if (flow.phase === 'pending' && key === lastChecked.current) {
      const firstWrong = marks.findIndex((m) => m === false);
      focusBlank(firstWrong >= 0 ? firstWrong : 0);
      return;
    }
    const m = gradeValues(values, block.blanks);
    setMarks(m);
    lastChecked.current = key;
    flow.submit({ values }, m.every(Boolean));
  }, [readOnly, values, flow, marks, block.blanks]);

  const change = (i: number, v: string) => {
    setValues((vs) => vs.map((x, j) => (j === i ? v : x)));
    setMarks((ms) => (ms[i] === undefined ? ms : ms.map((x, j) => (j === i ? undefined : x))));
    setEmptyWarn(false);
    if (flow.phase === 'pending') flow.retry();
  };

  const retry = () => {
    flow.retry();
    const firstWrong = marks.findIndex((m) => m === false);
    setTimeout(() => focusBlank(firstWrong >= 0 ? firstWrong : 0), 0);
  };

  const resultOf = (i: number): 'correct' | 'wrong' | 'revealed' | undefined => {
    if (!showMarks) return undefined;
    if (flow.revealed && marks[i] !== true) return 'revealed';
    if (marks[i] === true) return 'correct';
    if (marks[i] === false) return 'wrong';
    return undefined;
  };

  const wrongIdx = flow.revealed && !flow.correct ? block.blanks.map((_, i) => i).filter((i) => marks[i] !== true) : [];

  const runnable = block.code.replace(/___(\d+)/g, (_, d: string) => {
    const i = Number(d);
    return (flow.correct ? values[i] : block.blanks[i]?.[0]) ?? '';
  });
  const runMode = hasMain(runnable) ? 'run' : 'compile';

  const frameState = evaluated ? (flow.correct ? 'correct' : 'incorrect') : flow.phase === 'confidence' ? 'active' : 'idle';

  return (
    <BlockFrame icon={<PencilLine className="size-4" />} label="Boşlukları doldur" state={frameState}>
      <Html html={block.prompt} className="font-medium" />
      <div className="mt-3 overflow-hidden rounded-xl border border-[var(--code-border)]">
        <CodeView
          code={block.code}
          ariaLabel="Boşluklu kod"
          renderBlank={(i, key) => {
            const res = resultOf(i);
            const shown = res === 'revealed' ? (block.blanks[i]?.[0] ?? '') : (values[i] ?? '');
            return (
              <input
                key={key}
                ref={(el) => {
                  inputs.current[i] = el;
                }}
                className="fill-input"
                value={shown}
                data-result={res}
                readOnly={readOnly || res === 'revealed'}
                onChange={(e) => change(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    check();
                  }
                }}
                aria-label={`${i + 1}. boşluk`}
                aria-invalid={res === 'wrong' || undefined}
                autoComplete="off"
                autoCapitalize="off"
                spellCheck={false}
                style={{ width: `${Math.max(6, shown.length + 2)}ch` }}
              />
            );
          }}
        />
      </div>

      {(flow.phase === 'answer' || flow.phase === 'pending') && !evaluated && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={check}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Kontrol et
          </button>
          <span className="text-xs text-muted">
            {emptyWarn ? (
              <span className="text-warning">Önce tüm boşlukları doldur.</span>
            ) : (
              <span className="kbd-only">
                Boşluklar arasında <span className="kbd-hint">Tab</span> ile gez, <span className="kbd-hint">Enter</span> ile kontrol et.
              </span>
            )}
          </span>
        </div>
      )}

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
          onRetry={flow.phase === 'pending' ? retry : undefined}
          onReveal={flow.phase === 'pending' ? flow.reveal : undefined}
          pendingText="Kırmızı işaretli boşlukları düzelt; doğru olanlar yerinde kalır. İstersen doğrudan yazmaya başlayabilirsin."
        >
          {wrongIdx.length > 0 && (
            <ul className="mt-3 space-y-1.5 text-sm">
              {wrongIdx.map((i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-muted">{i + 1}. boşluk:</span>
                  <code className="inline-code line-through decoration-danger/70">{values[i] || '…'}</code>
                  <ArrowRight className="size-3.5 text-subtle" aria-label="yerine" />
                  <code className="inline-code">{block.blanks[i][0]}</code>
                  {block.blanks[i].length > 1 && (
                    <span className="text-xs text-subtle">
                      (şunlar da kabul: {block.blanks[i].slice(1).join(', ')})
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </FeedbackPanel>
      )}

      {flow.revealed && mode !== 'boss' && (
        <div className="mt-4">
          {!runner.result && !runner.running ? (
            <button
              type="button"
              onClick={() => runner.run({ code: runnable, mode: runMode, crates: block.crates })}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Play className="size-4 text-accent" />
              {runMode === 'run' ? 'Tamamlanan kodu çalıştır' : 'Tamamlanan kodu derle'}
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
