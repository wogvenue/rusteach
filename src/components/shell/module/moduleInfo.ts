// Pure helpers for the module page.
import { dueReviews, lessonStatus, moduleStatus, type ModuleStatus, type ProgressData } from '../../../store/progress';
import { getLesson, moduleLessons } from '../../../lib/content';
import type { Lesson, Module } from '../../../types/content';

export interface ModuleTotals {
  minutes: number;
  lessons: number;
  projects: number;
  checks: number;
  exercises: number;
  flashcards: number;
}

export function moduleTotals(m: Module): ModuleTotals {
  const ls = moduleLessons(m);
  return {
    minutes: ls.reduce((a, l) => a + (l.minutes || 0), 0),
    lessons: ls.length,
    projects: ls.filter((l) => l.type === 'project').length,
    checks: ls.reduce((a, l) => a + l.stats.checks, 0),
    exercises: ls.reduce((a, l) => a + l.stats.exercises, 0),
    flashcards: ls.reduce((a, l) => a + l.stats.flashcards, 0),
  };
}

export type NextKind = 'continue' | 'start' | 'boss' | 'review';

/** What the module's main button should open. */
export function moduleNext(s: ProgressData, m: Module): { lesson: Lesson; kind: NextKind } | undefined {
  const ls = moduleLessons(m);
  const inProgress = ls.find((l) => lessonStatus(s, l.id) === 'in_progress');
  if (inProgress) return { lesson: inProgress, kind: 'continue' };
  const open = ls.find((l) => lessonStatus(s, l.id) === 'available');
  if (open) return { lesson: open, kind: 'start' };
  const boss = m.bossId ? getLesson(m.bossId) : undefined;
  if (boss && !s.modules[m.id]?.bossPassed) {
    const st = lessonStatus(s, boss.id);
    if (st === 'available' || st === 'in_progress') return { lesson: boss, kind: 'boss' };
  }
  if (ls.length && ls.every((l) => s.lessons[l.id]?.status === 'completed')) return { lesson: ls[0], kind: 'review' };
  return undefined;
}

export function lessonsDone(s: ProgressData, m: Module): number {
  return m.lessonIds.filter((id) => s.lessons[id]?.status === 'completed').length;
}

/** Spaced-repetition numbers of one module. */
export function moduleSrs(s: ProgressData, m: Module, now = new Date()): { cards: number; due: number } {
  const cards = Object.values(s.srs).filter((e) => e.moduleId === m.id && !e.suspended).length;
  const due = dueReviews(s, now).filter((e) => e.moduleId === m.id).length;
  return { cards, due };
}

export function moduleSolvedExercises(s: ProgressData, m: Module): number {
  let n = 0;
  for (const l of moduleLessons(m))
    for (const step of l.steps) for (const b of step.blocks) if (b.type === 'exercise' && s.exercises[b.id]?.solved) n++;
  return n;
}

export const MODULE_STATUS_TONE: Record<ModuleStatus, 'neutral' | 'accent' | 'info' | 'gold' | 'success'> = {
  locked: 'neutral',
  available: 'accent',
  in_progress: 'info',
  completed: 'accent',
  mastered: 'gold',
};

export { moduleStatus };
