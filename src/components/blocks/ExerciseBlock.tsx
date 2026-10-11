// Coding exercise (generation effect): write code, run it, check it against tests / expected output,
// with progressive hints and - after real effort - the reference solution.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import {
  BadgeCheck, Dumbbell, Eye, FlaskConical, GitCompareArrows, Hammer, Lightbulb, Play, RotateCcw, Star, Wrench,
} from 'lucide-react';
import type { ExerciseBlock as ExerciseBlockT } from '../../types/content';
import type { RunResult } from '../../types/bridge';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import Ferris from '../Ferris';
import CodeEditor from '../editor/CodeEditor';
import CodeView from '../editor/CodeView';
import RunOutput from '../editor/RunOutput';
import { useRunner } from '../editor/useRunner';
import { hasMain, normalizeOutput, parseTestOutput, wrapTests } from '../../lib/runner';
import { useProgress } from '../../store/progress';
import { xpToast } from '../../store/ui';
import { play } from '../../lib/sound';
import { celebrateAt } from '../../lib/celebrate';
import { XpPill } from './CheckUi';
import { failureDetails, ruleViolations } from './exercise/checks';
import { OutputDiff, RuleViolations, TestResults } from './exercise/ResultPanels';

type Outcome = { passed: boolean } & (
  | { kind: 'rules'; messages: string[] }
  | { kind: 'run'; result: RunResult }
  | { kind: 'tests'; result: RunResult; ok: string[]; failed: string[]; details: Record<string, string> }
  | { kind: 'output'; result: RunResult; actual: string }
);

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" title={`Zorluk: ${n}/5`} aria-label={`Zorluk ${n}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={clsx('size-3.5', i <= n ? 'fill-xp text-xp' : 'text-border-strong')}
          strokeWidth={i <= n ? 1.5 : 2}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

const btnBase =
  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:cursor-not-allowed disabled:opacity-45';
const btnSecondary = `${btnBase} border border-border bg-surface-2 text-fg hover:border-border-strong hover:bg-elevated`;
const btnGhost = `${btnBase} text-muted hover:bg-surface-2 hover:text-fg`;

export default function ExerciseBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<ExerciseBlockT>) {
  const restoring = mode === 'lesson' && !fresh;
  const saved = useMemo(
    () => (restoring ? useProgress.getState().exercises[block.id] : undefined),
    [restoring, block.id],
  );
  const [code, setCode] = useState(() => saved?.code ?? block.starter);
  const [solved, setSolved] = useState(() => !!saved?.solved);
  const [usedSolution, setUsedSolution] = useState(() => !!saved?.usedSolution);
  const [hintsShown, setHintsShown] = useState(() => Math.min(saved?.hintsUsed ?? 0, block.hints.length));
  const [failedChecks, setFailedChecks] = useState(() => (saved && !saved.solved ? saved.attempts : 0));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [last, setLast] = useState<'run' | 'check' | null>(null);
  const [confirm, setConfirm] = useState<'reset' | 'solution' | null>(null);
  const [solutionOpen, setSolutionOpen] = useState(() => !!saved?.usedSolution && !saved?.solved);
  const [compareOpen, setCompareOpen] = useState(false);
  const [xp, setXp] = useState(0);
  const runner = useRunner();
  const checker = useRunner();
  const checkBtn = useRef<HTMLButtonElement>(null);
  const done = useRef(restoring && !!(saved?.solved || saved?.usedSolution));
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const boss = mode === 'boss';
  const libOnly = !hasMain(code);
  const runLabel = libOnly ? 'Derle' : 'Çalıştır';
  const modified = code !== block.starter;
  const canReveal = !boss && !solved && !usedSolution && (failedChecks >= 2 || (block.hints.length > 0 && hintsShown >= block.hints.length));

  // autosave the learner's code (lesson mode only)
  useEffect(() => {
    if (mode !== 'lesson') return;
    const t = setTimeout(() => {
      const prev = useProgress.getState().exercises[block.id]?.code;
      if (prev !== code && (prev !== undefined || code !== block.starter)) useProgress.getState().saveExerciseCode(block.id, code);
    }, 600);
    return () => clearTimeout(t);
  }, [code, mode, block.id, block.starter]);

  const finish = useCallback((correct: boolean, revealedSolution: boolean) => {
    if (done.current) return;
    done.current = true;
    onCompleteRef.current?.({ correct, revealedSolution });
  }, []);

  const fail = () => {
    setFailedChecks((n) => n + 1);
    useProgress.getState().recordExercise(block.id, lessonId, { solved: false });
    play('wrong');
  };

  const succeed = () => {
    const gained = useProgress.getState().recordExercise(block.id, lessonId, {
      solved: true,
      usedSolution,
      difficulty: block.difficulty,
    });
    setXp(gained);
    xpToast(gained, usedSolution ? 'Alıştırma (çözümle) tamamlandı' : 'Alıştırma çözüldü');
    play('correct');
    if (!solved) celebrateAt(checkBtn.current);
    setSolved(true);
    finish(!usedSolution, usedSolution);
  };

  const runFree = () => {
    setLast('run');
    void runner.run({ code, mode: libOnly ? 'compile' : 'run', crates: block.crates });
  };

  const check = async () => {
    if (checker.running) return;
    setLast('check');
    setConfirm(null);
    const violations = ruleViolations(code, block);
    if (violations.length) {
      checker.clear();
      setOutcome({ kind: 'rules', messages: violations, passed: false });
      fail();
      return;
    }
    setOutcome(null);
    if (block.check === 'tests') {
      const result = await checker.run({ code: wrapTests(code, block.tests ?? ''), mode: 'test', crates: block.crates });
      if (result.infraError) return;
      const parsed = parseTestOutput(result.stdout);
      const ok = result.ok && !result.compileError && parsed.total > 0 && parsed.failed.length === 0;
      setOutcome({ kind: 'tests', result, ok: parsed.passed, failed: parsed.failed, details: failureDetails(result.stdout), passed: ok });
      if (ok) succeed();
      else fail();
      return;
    }
    const result = await checker.run({ code, mode: 'run', crates: block.crates });
    if (result.infraError) return;
    if (block.check === 'output') {
      const ok = result.ok && normalizeOutput(result.stdout) === normalizeOutput(block.expectedOutput ?? '');
      setOutcome({ kind: 'output', result, actual: result.stdout, passed: ok });
      if (ok) succeed();
      else fail();
    } else {
      const ok = result.ok && !result.compileError;
      setOutcome({ kind: 'run', result, passed: ok });
      if (ok) succeed();
      else fail();
    }
  };

  const showHint = () => {
    if (hintsShown >= block.hints.length) return;
    const stored = useProgress.getState().exercises[block.id]?.hintsUsed ?? 0;
    if (!restoring || hintsShown >= stored) useProgress.getState().useHint(block.id);
    setHintsShown((n) => n + 1);
  };

  const revealSolution = () => {
    setConfirm(null);
    setUsedSolution(true);
    setSolutionOpen(true);
    useProgress.getState().recordExercise(block.id, lessonId, { solved: false, usedSolution: true });
    finish(false, true);
  };

  const reset = () => {
    setConfirm(null);
    setCode(block.starter);
    setOutcome(null);
    runner.clear();
    checker.clear();
  };

  const checkLabel = block.check === 'tests' ? 'Testleri çalıştır' : 'Kontrol et';
  const statusChip = solved ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">
      <BadgeCheck className="size-3.5" /> {usedSolution ? 'Çözümle tamamlandı' : 'Çözüldü'}
    </span>
  ) : usedSolution ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-info-soft px-2 py-0.5 text-xs font-semibold text-info">
      <Eye className="size-3.5" /> Çözüm görüldü
    </span>
  ) : null;

  const showOutcome = last === 'check' && !checker.running;
  const failedOutcome = showOutcome && !!outcome && !outcome.passed;
  const justSolved = showOutcome && !!outcome && outcome.passed;

  return (
    <BlockFrame
      icon={<Dumbbell className="size-4" />}
      label="Alıştırma"
      state={solved ? 'correct' : 'idle'}
      right={
        <span className="flex items-center gap-2.5">
          {statusChip}
          <Stars n={block.difficulty} />
        </span>
      }
      bodyClassName="px-5 pb-5 pt-1"
    >
      <h3 className="text-[1.05rem] font-semibold tracking-tight text-fg">{block.title}</h3>
      <Html html={block.prompt} className="mt-2" />

      {!block.starterCompiles && !solved && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-warning-soft px-3 py-2 text-sm text-fg">
          <Wrench className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>Başlangıç kodu şu an derlenmiyor; bu bilerek böyle. Görevin, derleyicinin şikâyet ettiği sorunu düzeltmek.</span>
        </p>
      )}

      {block.check === 'output' && block.expectedOutput && (
        <details className="group mt-3 rounded-xl border border-border bg-surface-2/50 open:bg-surface-2/70" open>
          <summary className="cursor-pointer select-none px-3.5 py-2 text-xs font-semibold text-muted hover:text-fg">
            Beklenen çıktı
          </summary>
          <pre className="overflow-x-auto border-t border-border px-3.5 py-2.5 font-mono text-[0.8rem] leading-relaxed text-fg">
            {block.expectedOutput}
          </pre>
        </details>
      )}

      <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--code-border)]">
        <CodeEditor
          value={code}
          onChange={setCode}
          onRun={check}
          onSecondary={runFree}
          minHeight="150px"
          maxHeight="560px"
          ariaLabel={`${block.title}, kod editörü`}
        />
        {last === 'run' && (runner.running || runner.result) && (
          <div className="border-t border-[var(--code-border)]">
            <RunOutput
              result={runner.result}
              running={runner.running}
              mode={runner.mode}
              startedAt={runner.startedAt}
              onClose={runner.clear}
            />
          </div>
        )}
        {last === 'check' && checker.running && (
          <div className="border-t border-[var(--code-border)]">
            <RunOutput result={null} running mode={checker.mode} startedAt={checker.startedAt} />
          </div>
        )}
        {last === 'check' && !checker.running && checker.result?.infraError && (
          <div className="border-t border-[var(--code-border)]">
            <RunOutput result={checker.result} mode={checker.mode} onClose={checker.clear} />
          </div>
        )}
      </div>

      {/* toolbar */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button ref={checkBtn} type="button" onClick={() => void check()} disabled={checker.running} className={`${btnBase} bg-accent text-accent-fg hover:bg-accent-strong`} title="Ctrl+Enter">
          <FlaskConical className="size-4" /> {checkLabel}
        </button>
        <button type="button" onClick={runFree} disabled={runner.running} className={btnSecondary} title="Ctrl+Shift+Enter">
          {libOnly ? <Hammer className="size-4" /> : <Play className="size-4" />} {runLabel}
        </button>
        {!boss && block.hints.length > 0 && (
          <button type="button" onClick={showHint} disabled={hintsShown >= block.hints.length} className={btnGhost}>
            <Lightbulb className="size-4" />
            İpucu
            <span className="text-xs font-medium text-subtle tabular-nums">
              {hintsShown}/{block.hints.length}
            </span>
          </button>
        )}
        <span className="flex-1" />
        {modified && confirm !== 'reset' && (
          <button type="button" onClick={() => setConfirm('reset')} className={btnGhost}>
            <RotateCcw className="size-4" /> Sıfırla
          </button>
        )}
        {confirm === 'reset' && (
          <span className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 py-1 pl-3 pr-1 text-sm">
            <span className="text-muted">Kodun başlangıç hâline dönsün mü?</span>
            <button type="button" onClick={reset} className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-on-danger hover:opacity-90 focus-visible:outline-2 focus-visible:outline-accent">
              Sıfırla
            </button>
            <button type="button" onClick={() => setConfirm(null)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent">
              Vazgeç
            </button>
          </span>
        )}
        {canReveal && confirm !== 'solution' && (
          <button type="button" onClick={() => setConfirm('solution')} className={btnGhost}>
            <Eye className="size-4" /> Çözümü göster
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {confirm === 'solution' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-3 rounded-2xl border border-border bg-surface-2/70 p-4">
              <p className="text-sm text-fg">
                Çözümü görmeden önce bir kez daha denemek beynini en çok çalıştıran yoldur.
                {hintsShown < block.hints.length && ' Henüz açmadığın ipuçları da var.'}
              </p>
              <p className="mt-1 text-xs text-muted">
                Çözümü görürsen alıştırma “çözümle tamamlandı” sayılır ve daha az XP kazanırsın.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={revealSolution} className={btnSecondary}>
                  <Eye className="size-4" /> Evet, çözümü göster
                </button>
                {hintsShown < block.hints.length && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirm(null);
                      showHint();
                    }}
                    className={btnGhost}
                  >
                    <Lightbulb className="size-4" /> Önce ipucu ver
                  </button>
                )}
                <button type="button" onClick={() => setConfirm(null)} className={btnGhost}>
                  Denemeye devam et
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* hints */}
      {hintsShown > 0 && !boss && (
        <ol className="mt-4 space-y-2">
          {block.hints.slice(0, hintsShown).map((h, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3 rounded-xl border border-xp/25 bg-xp/6 px-3.5 py-2.5"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-xp/20 text-[0.7rem] font-bold text-xp">
                {i + 1}
              </span>
              <Html html={h} size="sm" className="min-w-0 flex-1" />
            </motion.li>
          ))}
        </ol>
      )}

      {/* check results */}
      <AnimatePresence mode="wait" initial={false}>
        {failedOutcome && outcome && (
          <motion.div
            key={`fail-${failedChecks}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-4 space-y-3"
          >
            {outcome.kind === 'rules' && <RuleViolations messages={outcome.messages} />}
            {outcome.kind !== 'rules' && outcome.result.compileError && (
              <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
                <RunOutput result={outcome.result} mode={outcome.kind === 'tests' ? 'test' : 'run'} />
              </div>
            )}
            {outcome.kind === 'tests' && !outcome.result.compileError && (
              <>
                {outcome.ok.length + outcome.failed.length > 0 ? (
                  <TestResults passed={outcome.ok} failed={outcome.failed} details={outcome.details} />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
                    <RunOutput result={outcome.result} mode="test" />
                  </div>
                )}
              </>
            )}
            {outcome.kind === 'output' && !outcome.result.compileError && (
              outcome.result.ok ? (
                <OutputDiff expected={block.expectedOutput ?? ''} actual={outcome.actual} />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
                  <RunOutput result={outcome.result} mode="run" />
                </div>
              )
            )}
            {outcome.kind === 'run' && !outcome.result.compileError && (
              <div className="overflow-hidden rounded-2xl border border-[var(--code-border)]">
                <RunOutput result={outcome.result} mode="run" />
              </div>
            )}
            {!boss && failedChecks >= 2 && hintsShown < block.hints.length && (
              <p className="text-xs text-muted">Takıldıysan bir ipucu açmayı dene; her ipucu bir adım daha yaklaştırır.</p>
            )}
          </motion.div>
        )}

        {justSolved && (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="mt-4 overflow-hidden rounded-2xl border border-success/30 bg-success/6"
            role="status"
          >
            <div className="flex items-center gap-4 p-4">
              <Ferris mood="celebrate" size={64} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold text-success">
                    {usedSolution ? 'Program artık doğru çalışıyor.' : 'Harika, alıştırmayı çözdün!'}
                  </span>
                  <XpPill xp={xp} />
                </div>
                {outcome?.kind === 'tests' && (
                  <p className="mt-0.5 text-sm text-muted">{outcome.ok.length} testin hepsi geçti.</p>
                )}
                {outcome?.kind === 'output' && <p className="mt-0.5 text-sm text-muted">Çıktın beklenenle birebir aynı.</p>}
                {outcome?.kind === 'run' && <p className="mt-0.5 text-sm text-muted">Program derlendi ve hatasız çalıştı.</p>}
              </div>
            </div>
            {outcome && outcome.kind !== 'rules' && outcome.result.stdout && outcome.kind !== 'tests' && (
              <div className="border-t border-success/20">
                <RunOutput result={outcome.result} mode="run" maxHeight={200} />
              </div>
            )}
            {block.explanation && (
              <div className="border-t border-success/20 px-4 py-3">
                {boss ? (
                  <details>
                    <summary className="cursor-pointer select-none text-sm font-medium text-muted hover:text-fg">Açıklamayı göster</summary>
                    <Html html={block.explanation} size="sm" className="mt-2" />
                  </details>
                ) : (
                  <Html html={block.explanation} size="sm" />
                )}
              </div>
            )}
            {!boss && !usedSolution && (
              <div className="border-t border-success/20 px-4 py-2.5">
                <button
                  type="button"
                  onClick={() => setCompareOpen((v) => !v)}
                  aria-expanded={compareOpen}
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-fg hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <GitCompareArrows className="size-4 text-accent" />
                  {compareOpen ? 'Örnek çözümü gizle' : 'Çözümü karşılaştır'}
                </button>
                {compareOpen && (
                  <div className="mt-2">
                    <p className="mb-2 text-xs text-muted">
                      Örnek çözüm aşağıda. Seninki farklı olabilir; ikisi de doğru olabilir. Farklara bak: hangisi daha okunaklı?
                    </p>
                    <div className="overflow-hidden rounded-xl border border-[var(--code-border)]">
                      <CodeView code={block.solution} ariaLabel="Örnek çözüm" />
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* restored solved state (revisiting a lesson) */}
      {solved && !outcome && restoring && block.explanation && (
        <details className="mt-4 rounded-2xl border border-success/25 bg-success/5 px-4 py-3">
          <summary className="cursor-pointer select-none text-sm font-semibold text-success">Bu alıştırmayı çözdün, açıklamayı yeniden oku</summary>
          <Html html={block.explanation} size="sm" className="mt-2" />
          <div className="mt-3 overflow-hidden rounded-xl border border-[var(--code-border)]">
            <CodeView code={block.solution} ariaLabel="Örnek çözüm" />
          </div>
        </details>
      )}

      {/* revealed solution */}
      {usedSolution && solutionOpen && !boss && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-info/30 bg-info-soft p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-info">Örnek çözüm</span>
            <span className="text-xs text-muted">Satır satır oku, sonra kapatıp kendin yazmayı dene.</span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setCode(block.solution)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-fg hover:bg-surface focus-visible:outline-2 focus-visible:outline-accent"
            >
              Editöre aktar
            </button>
            <button
              type="button"
              onClick={() => setSolutionOpen(false)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-surface hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
            >
              Kapat
            </button>
          </div>
          <div className="mt-2 overflow-hidden rounded-xl border border-[var(--code-border)]">
            <CodeView code={block.solution} ariaLabel="Örnek çözüm" />
          </div>
          {block.explanation && <Html html={block.explanation} size="sm" className="mt-3" />}
        </motion.div>
      )}
      {usedSolution && !solutionOpen && !solved && !boss && (
        <button
          type="button"
          onClick={() => setSolutionOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-info hover:bg-info-soft focus-visible:outline-2 focus-visible:outline-accent"
        >
          <Eye className="size-3.5" /> Örnek çözümü yeniden aç
        </button>
      )}
    </BlockFrame>
  );
}
