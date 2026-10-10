// Module page: the lessons of a module as a vertical timeline. Each row shows its status, length,
// a "Proje" badge, expandable objectives and the right call to action.
import { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { Check, ChevronDown, Clock, Hammer, Lock, Play, RotateCcw, Target } from 'lucide-react';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/primitives';
import { lessonStatus, type LessonStatus, type ProgressData } from '../../../store/progress';
import { fmtPct } from '../turkish';
import type { Lesson } from '../../../types/content';

export default function LessonTimeline({ s, lessons }: { s: ProgressData; lessons: Lesson[] }) {
  if (!lessons.length) {
    return (
      <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
        Bu modülün dersleri hazırlanıyor. Yakında burada olacaklar.
      </p>
    );
  }
  return (
    <ol className="relative" aria-label="Dersler">
      {lessons.map((l, i) => (
        <LessonRow key={l.id} s={s} lesson={l} index={i} last={i === lessons.length - 1} />
      ))}
    </ol>
  );
}

function LessonRow({ s, lesson, index, last }: { s: ProgressData; lesson: Lesson; index: number; last: boolean }) {
  const navigate = useNavigate();
  const status = lessonStatus(s, lesson.id);
  const lp = s.lessons[lesson.id];
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const locked = status === 'locked';
  const project = lesson.type === 'project';
  const stepTotal = lesson.steps.length;
  const stepNow = lp && status === 'in_progress' ? Math.min(stepTotal, lp.step + 1) : 0;

  const action =
    status === 'completed'
      ? { label: 'Tekrar gözden geçir', icon: <RotateCcw className="size-4" />, variant: 'secondary' as const }
      : status === 'in_progress'
        ? { label: 'Devam et', icon: <Play className="size-4 fill-current" />, variant: 'primary' as const }
        : { label: 'Başla', icon: <Play className="size-4 fill-current" />, variant: 'primary' as const };

  return (
    <li className="relative flex gap-4 pb-3">
      {/* rail */}
      {!last && (
        <span
          aria-hidden
          className="absolute left-[19px] top-11 bottom-0 w-[2px] rounded-full"
          style={{
            background:
              status === 'completed'
                ? 'color-mix(in oklab, var(--tier) 55%, transparent)'
                : 'color-mix(in oklab, var(--c-fg) 10%, transparent)',
          }}
        />
      )}
      <StatusIcon status={status} project={project} number={index + 1} />

      <div
        className={clsx(
          'min-w-0 flex-1 rounded-2xl border bg-surface transition-colors',
          status === 'in_progress'
            ? 'border-[color-mix(in_oklab,var(--tier)_40%,var(--c-border))] shadow-[0_0_0_3px_color-mix(in_oklab,var(--tier)_12%,transparent)]'
            : 'border-border',
          !locked && 'hover:border-border-strong',
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
          <div className="min-w-0 flex-1 basis-[260px]">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted">
              <span>Ders {index + 1}</span>
              {lesson.minutes > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" aria-hidden />
                  {lesson.minutes} dk
                </span>
              )}
              {project && (
                <Badge tone="accent">
                  <Hammer className="size-3" aria-hidden />
                  Proje
                </Badge>
              )}
              {status === 'completed' && lp?.accuracy !== undefined && (
                <Badge tone="success">İlk denemede {fmtPct(lp.accuracy)}</Badge>
              )}
              {status === 'in_progress' && stepTotal > 1 && (
                <Badge tone="info">
                  Adım {stepNow}/{stepTotal}
                </Badge>
              )}
            </div>
            <h3 className={clsx('mt-1 text-[15px] font-semibold leading-6 tracking-[-0.01em]', locked ? 'text-muted' : 'text-fg')}>
              {lesson.title}
            </h3>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {lesson.objectives.length > 0 && (
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                Hedefler
                <ChevronDown className={clsx('size-4 transition-transform duration-200', open && 'rotate-180')} aria-hidden />
              </button>
            )}
            {locked ? (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-subtle">
                <Lock className="size-3.5" aria-hidden />
                Önceki dersi bitir
              </span>
            ) : (
              <Button
                size="sm"
                variant={action.variant}
                icon={action.icon}
                onClick={() => navigate(`/ders/${lesson.id}`)}
                aria-label={`${action.label}: ${lesson.title}`}
              >
                {action.label}
              </Button>
            )}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              id={panelId}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border px-4 pb-4 pt-3">
                <p className="mb-2 text-xs font-semibold text-muted">Bu dersin sonunda</p>
                <ul className="space-y-1.5">
                  {lesson.objectives.map((o, i) => (
                    <li key={i} className="flex gap-2 text-sm leading-6 text-fg">
                      <Target className="mt-1 size-3.5 shrink-0 tier-ink" aria-hidden />
                      <span className="lesson-prose prose-sm" dangerouslySetInnerHTML={{ __html: o }} />
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </li>
  );
}

const STATUS_TEXT: Record<LessonStatus, string> = {
  locked: 'Kilitli',
  available: 'Başlamaya hazır',
  in_progress: 'Devam ediyor',
  completed: 'Tamamlandı',
};

function StatusIcon({ status, project, number }: { status: LessonStatus; project: boolean; number: number }) {
  return (
    <span
      className={clsx(
        'relative z-[1] mt-2 grid size-10 shrink-0 place-items-center rounded-full border-2 text-sm font-semibold tabular-nums',
        status === 'locked' && 'border-border bg-surface-2 text-subtle',
        status === 'available' && 'border-[var(--tier)] bg-surface tier-ink',
        status === 'in_progress' && 'border-[var(--tier)] bg-[color-mix(in_oklab,var(--tier)_16%,var(--c-surface))] tier-ink',
        status === 'completed' && 'border-transparent text-[#1a0b02]',
      )}
      style={status === 'completed' ? { background: 'var(--tier)' } : undefined}
    >
      {status === 'completed' ? (
        <Check className="size-5" strokeWidth={3} aria-hidden />
      ) : status === 'locked' ? (
        <Lock className="size-4" aria-hidden />
      ) : project ? (
        <Hammer className="size-4" aria-hidden />
      ) : (
        <span aria-hidden>{number}</span>
      )}
      {status === 'in_progress' && (
        <span aria-hidden className="absolute inset-[-5px] rounded-full border-2 border-[var(--tier)] opacity-40 animate-pulse-ring" />
      )}
      <span className="sr-only">{STATUS_TEXT[status]}</span>
    </span>
  );
}
