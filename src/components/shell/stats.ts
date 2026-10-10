// Pure, shell-side derived values on top of the progress store.
import { addDays, dayKey, moduleStatus, nextLessonId, type DayActivity, type ModuleStatus, type ProgressData } from '../../store/progress';
import { getLesson, getModule, modules, modulesOfTier, tiers } from '../../lib/content';
import type { Module, Tier } from '../../types/content';

export function isActiveDay(a: DayActivity | undefined): boolean {
  return !!a && (a.xp > 0 || a.checks > 0 || a.lessons > 0 || a.reviews > 0 || a.exercises > 0);
}

/** Streak as the learner experiences it today (a broken streak shows 0 until they study again). */
export function effectiveStreak(s: ProgressData, today = dayKey()): number {
  const { lastDay, current, freezes } = s.streak;
  if (!lastDay) return 0;
  if (lastDay === today || lastDay === addDays(today, -1)) return current;
  if (lastDay === addDays(today, -2) && freezes > 0) return current; // a freeze will cover yesterday
  return 0;
}

export function studiedToday(s: ProgressData, today = dayKey()): boolean {
  return s.streak.lastDay === today && isActiveDay(s.activity[today]);
}

export function completedLessonCount(s: ProgressData): number {
  let n = 0;
  for (const [id, lp] of Object.entries(s.lessons)) {
    if (lp.status !== 'completed') continue;
    const l = getLesson(id);
    if (l && l.type !== 'boss') n++;
  }
  return n;
}

export function solvedExerciseCount(s: ProgressData): number {
  return Object.values(s.exercises).filter((e) => e.solved).length;
}

/** Flashcards that graduated to long-term review (FSRS state Review / Relearning). */
export function learnedCardCount(s: ProgressData): number {
  return Object.values(s.srs).filter((e) => e.kind === 'flashcard' && e.card.state >= 2).length;
}

export function firstTryAccuracy(s: ProgressData): number | null {
  const all = Object.values(s.blocks);
  if (!all.length) return null;
  return all.filter((b) => b.firstTry).length / all.length;
}

export function masteredModules(s: ProgressData): Module[] {
  return modules.filter((m) => s.modules[m.id]?.bossPassed);
}

export function journeyComplete(s: ProgressData): boolean {
  return modules.length > 0 && modules.every((m) => s.modules[m.id]?.bossPassed);
}

export function isBrandNew(s: ProgressData): boolean {
  return s.xp === 0 && Object.keys(s.lessons).length === 0 && Object.keys(s.blocks).length === 0;
}

/** The module the learner is working on now (module of the next lesson). */
export function currentModule(s: ProgressData): Module | undefined {
  const id = nextLessonId(s);
  const lesson = id ? getLesson(id) : undefined;
  return lesson ? getModule(lesson.moduleId) : undefined;
}

export function currentTier(s: ProgressData): Tier | undefined {
  const m = currentModule(s) ?? masteredModules(s).at(-1) ?? modules[0];
  return m ? tiers.find((t) => t.id === m.tier) : tiers[0];
}

export function tierProgress(s: ProgressData, tierId: string): { mastered: number; total: number; statuses: ModuleStatus[] } {
  const ms = modulesOfTier(tierId);
  const statuses = ms.map((m) => moduleStatus(s, m));
  return { mastered: statuses.filter((x) => x === 'mastered').length, total: ms.length, statuses };
}

/** Number of last `n` days (ending today) with any study activity. */
export function activeDaysIn(s: ProgressData, n: number, today = dayKey()): number {
  let c = 0;
  for (let i = 0; i < n; i++) if (isActiveDay(s.activity[addDays(today, -i)])) c++;
  return c;
}

export const STATUS_LABEL: Record<ModuleStatus, string> = {
  locked: 'Kilitli',
  available: 'Başlamaya hazır',
  in_progress: 'Devam ediyor',
  completed: 'Sınav seni bekliyor',
  mastered: 'Ustalaşıldı',
};
