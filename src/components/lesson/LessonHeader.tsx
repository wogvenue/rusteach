// Lesson opening card: what this lesson is for (objectives), how long it takes, and the start /
// warm-up choice on a first visit.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Clock3, Flame, Hammer, Target } from 'lucide-react';
import type { Lesson, Module } from '../../types/content';
import { Button } from '../ui/Button';
import { Kbd } from '../ui/primitives';
import Html from '../blocks/Html';

export default function LessonHeader({
  lesson,
  module,
  status,
  warmupCount,
  onStart,
  onWarmup,
  children,
}: {
  lesson: Lesson;
  module?: Module;
  /** new = first visit, resume = in progress, done = completed before. */
  status: 'new' | 'resume' | 'done' | 'started';
  warmupCount: number;
  onStart?: () => void;
  onWarmup?: () => void;
  children?: ReactNode;
}) {
  const position = module ? module.lessonIds.indexOf(lesson.id) + 1 : 0;
  const project = lesson.type === 'project';
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6 shadow-card sm:p-8"
      aria-labelledby="lesson-title"
    >
      <div
        className="pointer-events-none absolute -right-16 -top-24 size-72 rounded-full opacity-60 blur-3xl"
        style={{ background: `radial-gradient(circle, color-mix(in srgb, ${module?.color ?? 'var(--c-accent)'} 22%, transparent), transparent 70%)` }}
        aria-hidden="true"
      />
      <div className="relative">
        <div className="flex items-center gap-3">
          <span
            className="grid size-11 shrink-0 place-items-center rounded-2xl text-xl"
            style={{ background: `color-mix(in srgb, ${module?.color ?? 'var(--c-accent)'} 16%, transparent)` }}
            aria-hidden="true"
          >
            {module?.icon ?? '🦀'}
          </span>
          <div className="min-w-0 text-sm text-muted">
            {module && (
              <div className="truncate">
                Modül {module.number}: {module.title}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-subtle">
              {position > 0 && <span>{project ? 'Proje dersi' : `${position}. ders`}</span>}
              <span className="inline-flex items-center gap-1">
                <Clock3 className="size-3.5" /> yaklaşık {lesson.minutes} dakika
              </span>
              {project && (
                <span className="inline-flex items-center gap-1 text-accent">
                  <Hammer className="size-3.5" /> Uygulamalı proje
                </span>
              )}
            </div>
          </div>
        </div>

        <h1 id="lesson-title" className="mt-5 text-[clamp(1.6rem,2.6vw,2.15rem)] font-bold leading-tight tracking-[-0.025em] text-fg">
          {lesson.title}
        </h1>

        {lesson.objectives.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-fg">
              <Target className="size-4 text-accent" /> Bu derste…
            </div>
            <ul className="space-y-2">
              {lesson.objectives.map((o, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.08 + i * 0.06 }}
                  className="flex gap-3 text-[0.95rem] leading-relaxed text-fg"
                >
                  <span className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />
                  <Html as="span" html={o} prose={false} className="min-w-0" />
                </motion.li>
              ))}
            </ul>
          </div>
        )}

        {status === 'new' && (
          <div className="mt-7">
            {warmupCount > 0 ? (
              <div className="rounded-2xl border border-streak/25 bg-streak/6 p-4">
                <div className="flex items-start gap-3">
                  <Flame className="mt-0.5 size-5 shrink-0 text-streak" />
                  <div className="min-w-0">
                    <div className="font-semibold text-fg">Isınma turu</div>
                    <p className="mt-0.5 text-sm text-muted">
                      Başlamadan önce önceki derslerden {warmupCount} kısa hatırlatma. Eski bilgiyi geri çağırmak, yenisine
                      sağlam bir zemin hazırlar.
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button onClick={onWarmup} icon={<Flame className="size-4" />} autoFocus>
                    Isınarak başla
                  </Button>
                  <Button variant="ghost" onClick={onStart}>
                    Doğrudan derse geç
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button size="lg" onClick={onStart} autoFocus>
                  Derse başla
                </Button>
                <span className="text-xs text-muted">
                  ya da <Kbd>Enter</Kbd>
                </span>
              </div>
            )}
          </div>
        )}
        {children}
      </div>
    </motion.section>
  );
}
