// Module mastery test: rules, the items step by step in "boss" mode (first answer counts, no
// solutions), then the score with a per-item review and retry.
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Swords } from 'lucide-react';
import type { Lesson, Module } from '../../types/content';
import { useProgress } from '../../store/progress';
import { nextModule } from '../../lib/content';
import { celebrateBig, celebrateGold } from '../../lib/celebrate';
import { play } from '../../lib/sound';
import { Button } from '../ui/Button';
import LessonTopBar from './LessonTopBar';
import StepSection from './StepSection';
import ContinueBar from './ContinueBar';
import { BossIntro, BossResult, type BossItemResult } from './BossScreens';
import { useStepFlow } from './useStepFlow';
import { lessonScored } from './gating';
import { useEnterKey, useSessionXp, useStudyTimer } from './hooks';
import { useScrollToStep } from './useScrollToStep';

type Phase = 'intro' | 'run' | 'result' | 'review';

interface Result {
  score: number;
  passed: boolean;
  xp: number;
  best: number;
  items: BossItemResult[];
}

export default function BossPlayer({ lesson, module, asSkipTest }: { lesson: Lesson; module?: Module; asSkipTest: boolean }) {
  const navigate = useNavigate();
  const scored = useMemo(() => lessonScored(lesson), [lesson]);
  const counts = useMemo(
    () => ({ checks: scored.filter((b) => b.type !== 'exercise').length, exercises: scored.filter((b) => b.type === 'exercise').length }),
    [scored],
  );
  const record = useProgress((s) => (module ? s.modules[module.id] : undefined));
  const [phase, setPhase] = useState<Phase>('intro');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const flow = useStepFlow({ lesson, initialRevealed: 0 });
  const sessionXp = useSessionXp();
  const scroller = useRef<HTMLDivElement>(null);
  const { refFor, scrollToStep, scrollTop } = useScrollToStep(scroller);
  useStudyTimer(true);

  const start = useCallback(() => {
    useProgress.getState().startLesson(lesson.id);
    flow.reset();
    setResult(null);
    setAttempt((a) => a + 1);
    setPhase('run');
    scrollTop();
  }, [flow, lesson.id, scrollTop]);

  const finish = useCallback(() => {
    const items: BossItemResult[] = scored.map((b) => {
      const o = flow.outcomes[b.id];
      return { block: b, correct: !!o && o.correct && !o.revealedSolution, skipped: !o };
    });
    const score = items.length ? items.filter((i) => i.correct).length / items.length : 0;
    const r = module
      ? useProgress.getState().submitBoss(module.id, score, { asSkipTest })
      : { passed: score >= 0.8, xp: 0, best: score };
    setResult({ score, passed: r.passed, xp: r.xp, best: r.best, items });
    setPhase('result');
    scrollTop();
    if (r.passed) {
      play('complete');
      celebrateBig();
      window.setTimeout(celebrateGold, 700);
    } else play('wrong');
  }, [scored, flow.outcomes, module, asSkipTest, scrollTop]);

  const onContinue = useCallback(() => {
    if (!flow.ready) return;
    if (flow.isLast) return finish();
    const next = flow.revealed + 1;
    flow.advance();
    scrollToStep(next);
  }, [flow, finish, scrollToStep]);

  useEnterKey(phase === 'run' && flow.ready, onContinue);

  const exit = () => navigate(module ? `/modul/${module.id}` : '/');
  const showSteps = phase === 'run' || phase === 'review';
  const answered = Object.keys(flow.outcomes).length;
  const nm = module ? nextModule(module) : undefined;

  return (
    <div className="lesson-root flex h-full flex-col text-fg">
      <LessonTopBar
        module={module}
        lesson={lesson}
        segments={flow.segments(phase === 'intro' ? 'before' : phase === 'run' ? 'steps' : 'all')}
        onJump={phase === 'run' || phase === 'review' ? (i) => scrollToStep(i) : undefined}
        sessionXp={sessionXp}
        onExit={exit}
        right={
          phase === 'run' ? (
            <span className="hidden h-8 items-center gap-1.5 rounded-full bg-surface-2 px-2.5 text-xs font-semibold tabular-nums text-muted md:inline-flex">
              <Swords className="size-3.5 text-accent" aria-hidden="true" />
              {answered}/{scored.length}
            </span>
          ) : undefined
        }
      />
      <div ref={scroller} className="lesson-scroll soft-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'intro' && (
            <motion.div key="intro" exit={{ opacity: 0 }}>
              <BossIntro
                module={module}
                checks={counts.checks}
                exercises={counts.exercises}
                best={record?.bossBest ?? 0}
                attempts={record?.bossAttempts ?? 0}
                asSkipTest={asSkipTest}
                onStart={start}
                onExit={exit}
              />
            </motion.div>
          )}
          {phase === 'result' && result && (
            <motion.div key="result" exit={{ opacity: 0 }}>
              <BossResult
                module={module}
                nextModule={result.passed ? nm : undefined}
                score={result.score}
                passed={result.passed}
                xp={result.xp}
                best={result.best}
                items={result.items}
                onRetry={start}
                onReview={() => {
                  setPhase('review');
                  scrollTop();
                }}
                onNavigate={(to) => navigate(to)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* the attempt stays mounted behind the result screen so "Cevaplarımı incele" shows the answers */}
        {attempt > 0 && (
          <div className={showSteps ? 'mx-auto w-full max-w-[50rem] px-4 pt-8 sm:px-6 sm:pt-10' : 'hidden'} key={attempt}>
            {phase === 'review' && result && (
              <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
                <p className="min-w-0 flex-1 text-sm text-muted">
                  Cevaplarını inceliyorsun. Skorun <span className="font-semibold text-fg">%{Math.round(result.score * 100)}</span>;
                  burada yaptığın değişiklikler skoru etkilemez.
                </p>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<ArrowLeft className="size-3.5" />}
                  onClick={() => {
                    setPhase('result');
                    scrollTop();
                  }}
                >
                  Sonuca dön
                </Button>
              </div>
            )}
            {lesson.steps.slice(0, flow.revealed + 1).map((step, i) => (
              <StepSection
                key={i}
                ref={refFor(i)}
                step={step}
                index={i}
                state={i < flow.revealed || phase === 'review' ? 'done' : 'current'}
                lessonId={lesson.id}
                mode="boss"
                fresh
                onBlockComplete={flow.onBlockComplete}
                animateIn={i > 0}
              />
            ))}
            {phase === 'run' && (
              <ContinueBar
                ready={flow.ready}
                pendingChecks={flow.pending.checks}
                pendingReflects={flow.pending.reflects}
                pendingExercises={flow.pending.exercises}
                label={flow.isLast ? 'Sınavı bitir' : 'Devam'}
                onContinue={onContinue}
                onSkipExercises={flow.deferExercises}
                skipLabel="Alıştırmayı geç"
                skipHint="Alıştırmayı çöz ya da geç; geçtiğin alıştırma yanlış sayılır."
              />
            )}
            {phase === 'review' && <div className="h-16" />}
          </div>
        )}
      </div>
    </div>
  );
}
