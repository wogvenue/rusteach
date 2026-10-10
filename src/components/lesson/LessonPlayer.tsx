// The lesson player (focus mode): objectives + optional warm-up, then the steps revealed one at a
// time with "Devam" gated on the step's checks, then the completion screen.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDown, CircleCheck, History } from 'lucide-react';
import type { Lesson, Module } from '../../types/content';
import { dueReviews, useProgress } from '../../store/progress';
import { getLesson, nextModule } from '../../lib/content';
import { celebrateBig } from '../../lib/celebrate';
import { play } from '../../lib/sound';
import { Button } from '../ui/Button';
import LessonTopBar from './LessonTopBar';
import LessonHeader from './LessonHeader';
import StepSection from './StepSection';
import ContinueBar from './ContinueBar';
import NotesPanel from './NotesPanel';
import WarmupPanel from './WarmupPanel';
import CompletionScreen, { type NextStep } from './CompletionScreen';
import { useStepFlow } from './useStepFlow';
import { lessonAccuracy, priorResolved } from './gating';
import { useEnterKey, useSessionXp, useStudyTimer } from './hooks';
import { useScrollToStep } from './useScrollToStep';

type Phase = 'intro' | 'warmup' | 'steps' | 'complete';

interface CompletionInfo {
  newCards: number;
  repeat: boolean;
  accuracy: { correct: number; answered: number; ratio: number | null };
  dueCount: number;
}

function nextStepFor(lesson: Lesson, module?: Module): NextStep | undefined {
  if (!module) return undefined;
  const idx = module.lessonIds.indexOf(lesson.id);
  const nextId = idx >= 0 ? module.lessonIds[idx + 1] : undefined;
  if (nextId) return { kind: 'lesson', to: `/ders/${nextId}`, title: getLesson(nextId)?.title ?? 'Sonraki ders' };
  if (module.bossId) return { kind: 'boss', to: `/ders/${module.bossId}`, title: 'Modül sınavı' };
  const nm = nextModule(module);
  return nm ? { kind: 'module', to: `/modul/${nm.id}`, title: nm.title } : undefined;
}

export default function LessonPlayer({ lesson, module }: { lesson: Lesson; module?: Module }) {
  const navigate = useNavigate();
  const entry = useMemo(() => {
    const s = useProgress.getState();
    const lp = s.lessons[lesson.id];
    const warmup = lp
      ? []
      : dueReviews(s)
          .filter((e) => e.lessonId !== lesson.id)
          .slice(0, 3);
    return {
      lp,
      warmup,
      resolved: priorResolved(s, lesson),
      initialRevealed: lp ? (lp.status === 'completed' ? lesson.steps.length - 1 : lp.step) : 0,
    };
    // computed once per mounted lesson
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  const [phase, setPhase] = useState<Phase>(entry.lp ? 'steps' : 'intro');
  const [notesOpen, setNotesOpen] = useState(false);
  const [finished, setFinished] = useState<CompletionInfo | null>(null);
  const flow = useStepFlow({ lesson, initialRevealed: entry.initialRevealed, initialResolved: entry.resolved });
  const sessionXp = useSessionXp();
  const seconds = useStudyTimer(true);
  const scroller = useRef<HTMLDivElement>(null);
  const { refFor, scrollToStep, scrollTop } = useScrollToStep(scroller);
  const mountedRevealed = useRef(entry.initialRevealed);
  const wasCompleted = entry.lp?.status === 'completed';

  // a resumed / revisited lesson becomes the "last lesson" of the dashboard
  useEffect(() => {
    if (entry.lp) useProgress.getState().startLesson(lesson.id);
  }, [entry.lp, lesson.id]);

  // jump to the step where the learner left off
  useEffect(() => {
    if (entry.lp && entry.lp.status !== 'completed' && entry.initialRevealed > 0) scrollToStep(entry.initialRevealed, false);
  }, [entry, scrollToStep]);

  const start = useCallback(() => {
    useProgress.getState().startLesson(lesson.id);
    setPhase('steps');
    requestAnimationFrame(() => scrollToStep(0));
  }, [lesson.id, scrollToStep]);

  const complete = useCallback(() => {
    if (finished) {
      setPhase('complete');
      scrollTop();
      return;
    }
    const s = useProgress.getState();
    const accuracy = lessonAccuracy(lesson, s, flow.outcomes, true);
    const r = s.completeLesson(lesson.id, { accuracy: accuracy.ratio ?? undefined });
    setFinished({
      newCards: r.newCards,
      repeat: !r.firstTime,
      accuracy,
      dueCount: dueReviews(useProgress.getState()).length,
    });
    setPhase('complete');
    scrollTop();
    play('complete');
    celebrateBig();
  }, [finished, lesson, flow.outcomes, scrollTop]);

  const onContinue = useCallback(() => {
    if (!flow.ready) return;
    if (flow.isLast) return complete();
    const next = flow.revealed + 1;
    flow.advance();
    useProgress.getState().setLessonStep(lesson.id, next);
    scrollToStep(next);
  }, [flow, complete, lesson.id, scrollToStep]);

  useEnterKey(phase === 'steps' && flow.ready && !notesOpen, onContinue);
  useEnterKey(phase === 'intro' && entry.warmup.length === 0, start);

  const exit = () => navigate(module ? `/modul/${module.id}` : '/');
  const segState = phase === 'complete' ? 'all' : phase === 'steps' ? 'steps' : 'before';
  const continueLabel = flow.isLast
    ? finished
      ? 'Sonuç ekranına dön'
      : wasCompleted
        ? 'Dersi yeniden tamamla'
        : 'Dersi bitir'
    : 'Devam';
  const resumeStep = entry.lp && entry.lp.status !== 'completed' && entry.initialRevealed > 0;

  return (
    <div className="lesson-root flex h-full flex-col text-fg">
      <LessonTopBar
        module={module}
        lesson={lesson}
        segments={flow.segments(segState)}
        onJump={phase === 'steps' ? (i) => scrollToStep(i) : undefined}
        sessionXp={sessionXp}
        onExit={exit}
        notesOpen={notesOpen}
        onToggleNotes={() => setNotesOpen((o) => !o)}
      />
      <div ref={scroller} className="lesson-scroll soft-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'complete' && finished ? (
            <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CompletionScreen
                lesson={lesson}
                module={module}
                xp={sessionXp}
                accuracy={finished.accuracy}
                newCards={finished.newCards}
                seconds={seconds.current}
                deferred={flow.deferred.size}
                dueCount={finished.dueCount}
                next={nextStepFor(lesson, module)}
                onNavigate={(to) => navigate(to)}
                onBack={() => {
                  setPhase('steps');
                  requestAnimationFrame(() => scrollToStep(flow.revealed, false));
                }}
                repeat={finished.repeat}
              />
            </motion.div>
          ) : (
            <motion.div
              key="lesson"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto w-full max-w-[50rem] px-4 pt-8 sm:px-6 sm:pt-10"
            >
              <LessonHeader
                lesson={lesson}
                module={module}
                status={phase === 'intro' ? 'new' : phase === 'warmup' ? 'started' : wasCompleted ? 'done' : entry.lp ? 'resume' : 'started'}
                warmupCount={entry.warmup.length}
                onStart={start}
                onWarmup={() => setPhase('warmup')}
              >
                {wasCompleted && phase === 'steps' && !finished && (
                  <div className="mt-6 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/6 px-4 py-3">
                    <CircleCheck className="size-4 shrink-0 text-success" aria-hidden="true" />
                    <p className="text-sm text-muted">
                      Bu dersi daha önce tamamladın. Cevapların yerinde duruyor; istediğin bölümü yeniden okuyup kodları tekrar
                      çalıştırabilirsin.
                    </p>
                  </div>
                )}
                {resumeStep && phase === 'steps' && (
                  <ResumeNote step={entry.initialRevealed} onJump={() => scrollToStep(entry.initialRevealed)} />
                )}
              </LessonHeader>

              {phase === 'warmup' && <WarmupPanel items={entry.warmup} onDone={start} />}

              {phase === 'steps' && (
                <div className="mt-10">
                  {lesson.steps.slice(0, flow.revealed + 1).map((step, i) => (
                    <StepSection
                      key={i}
                      ref={refFor(i)}
                      step={step}
                      index={i}
                      state={i < flow.revealed || finished ? 'done' : 'current'}
                      lessonId={lesson.id}
                      mode="lesson"
                      onBlockComplete={flow.onBlockComplete}
                      animateIn={i > mountedRevealed.current}
                    />
                  ))}
                  <ContinueBar
                    ready={flow.ready}
                    pendingChecks={flow.pending.checks}
                    pendingReflects={flow.pending.reflects}
                    pendingExercises={flow.pending.exercises}
                    label={continueLabel}
                    onContinue={onContinue}
                    onSkipExercises={flow.deferExercises}
                  />
                </div>
              )}
              {phase !== 'steps' && <div className="h-16" />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <NotesPanel lessonId={lesson.id} open={notesOpen} onClose={() => setNotesOpen(false)} />
    </div>
  );
}

function ResumeNote({ step, onJump }: { step: number; onJump: () => void }) {
  return (
    <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface-2/60 px-4 py-3">
      <History className="size-4 shrink-0 text-accent" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-muted">
        Kaldığın yerden devam ediyorsun: <span className="font-semibold text-fg">{step + 1}. adım</span>. Önceki adımlar
        ve cevapların aşağıda duruyor.
      </p>
      <Button size="sm" variant="secondary" onClick={onJump} icon={<ArrowDown className="size-3.5" aria-hidden="true" />}>
        Kaldığım adıma git
      </Button>
    </div>
  );
}
