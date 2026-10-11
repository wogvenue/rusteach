// The single persisted learner-progress store (zustand + localStorage).
// Pages/components read with selectors: const xp = useProgress((s) => s.xp)
// and call actions: useProgress.getState().completeLesson(id)
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isDue, newCard, reviewCard, type Grade, type SerializedCard } from '../lib/srs';
import { findBlock, getLesson, getModule, lessonFlashcards, moduleLessons, modules } from '../lib/content';
import type { Module } from '../types/content';

// ------------------------------------------------------------------ constants

export const XP = {
  checkFirstTry: 10,
  checkLater: 3,
  exerciseBase: 20,
  exercisePerDifficulty: 10,
  exerciseHintPenalty: 5,
  exerciseWithSolution: 5,
  lessonComplete: 40,
  projectComplete: 80,
  lessonRepeat: 10,
  bossPass: 150,
  bossPerfectBonus: 50,
  bossRepeatPass: 20,
  review: 3,
  reviewAgain: 1,
  reflect: 5,
  dailyGoalBonus: 25,
} as const;

export const BOSS_PASS_THRESHOLD = 0.8;

// ------------------------------------------------------------------ dates

/** Local calendar day key, YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + n);
  return dayKey(date);
}

const nowIso = () => new Date().toISOString();

// ------------------------------------------------------------------ types

export type Confidence = 1 | 2 | 3; // 1 = tahmin ettim, 2 = biraz emindim, 3 = çok emindim

export interface LessonProgress {
  status: 'in_progress' | 'completed';
  step: number; // furthest step reached (0-based)
  startedAt: string;
  completedAt?: string;
  completions: number;
  accuracy?: number; // 0..1 first-try accuracy on scored blocks at last completion
}

export interface BlockResult {
  correct: boolean; // latest result
  firstTry: boolean; // was the very first attempt correct?
  attempts: number;
  confidence?: Confidence;
  at: string;
  answer?: unknown; // last answer (component specific), used to restore the UI
}

export interface ExerciseProgress {
  solved: boolean;
  attempts: number; // check runs
  hintsUsed: number;
  usedSolution: boolean;
  code?: string; // learner's latest code (autosaved)
  solvedAt?: string;
}

export interface ModuleProgress {
  bossBest: number; // 0..1
  bossAttempts: number;
  bossPassed: boolean;
  skipUnlocked?: boolean; // unlocked by passing the boss as a placement test
  masteredAt?: string;
}

export type SrsKind = 'flashcard' | 'check';

export interface SrsEntry {
  id: string; // flashcard id or check block id
  kind: SrsKind;
  lessonId: string;
  moduleId: string;
  addedAt: string;
  card: SerializedCard;
  suspended?: boolean;
}

export interface ReviewLogEntry {
  id: string;
  at: string;
  grade: Grade;
}

export interface MistakeEntry {
  blockId: string;
  lessonId: string;
  moduleId: string;
  count: number;
  lastAt: string;
  resolved: boolean;
  note?: string; // learner's own "Neden yanıldım?" note (mistakes notebook)
  resolvedAt?: string;
}

export interface DayActivity {
  xp: number;
  lessons: number;
  reviews: number;
  checks: number;
  exercises: number;
  seconds: number;
  goalBonus?: boolean;
}

export interface XpEvent {
  at: string;
  amount: number;
  reason: string;
}

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  runner: 'auto' | 'local' | 'online';
  sound: boolean;
  reducedMotion: boolean;
  editorFontSize: number; // px
  contentScale: number; // 0.9 .. 1.25 multiplier for lesson text
  dailyGoalXp: number;
  newCardsPerDay: number;
  showConfidence: boolean; // ask "ne kadar emindin?" after checks
  freeMode: boolean; // all modules unlocked
}

export interface Profile {
  name: string;
  createdAt: string;
  onboarded: boolean;
  experience?: 'none' | 'some' | 'experienced';
  goal?: string;
}

export interface ProgressData {
  profile: Profile;
  settings: Settings;
  xp: number;
  activity: Record<string, DayActivity>;
  streak: { current: number; best: number; lastDay: string | null; freezes: number; frozenDays: string[] };
  lessons: Record<string, LessonProgress>;
  blocks: Record<string, BlockResult>;
  exercises: Record<string, ExerciseProgress>;
  modules: Record<string, ModuleProgress>;
  srs: Record<string, SrsEntry>;
  reviewLog: ReviewLogEntry[];
  mistakes: Record<string, MistakeEntry>;
  notes: Record<string, string>; // lessonId -> learner's own notes (Feynman)
  reflections: Record<string, { text: string; rating?: 1 | 2 | 3; at: string }>;
  achievements: Record<string, string>; // id -> unlockedAt
  recentXp: XpEvent[]; // newest first, max 100
  lastLessonId?: string;
  totalSeconds: number;
}

export interface ProgressActions {
  completeOnboarding(p: Partial<Profile>): void;
  updateProfile(p: Partial<Profile>): void;
  updateSettings(s: Partial<Settings>): void;
  addXp(amount: number, reason: string): number;
  startLesson(lessonId: string): void;
  setLessonStep(lessonId: string, step: number): void;
  /** Records a check result (quiz/predict/compiles/fill/parsons). Returns xp gained. */
  recordBlock(
    blockId: string,
    lessonId: string,
    r: { correct: boolean; confidence?: Confidence; answer?: unknown; context?: 'lesson' | 'review' | 'boss' | 'practice' },
  ): { xp: number; firstTry: boolean };
  setBlockConfidence(blockId: string, confidence: Confidence): void;
  saveExerciseCode(exerciseId: string, code: string): void;
  useHint(exerciseId: string): void;
  /** Called after each "Kontrol et" run of an exercise. Returns xp gained (only on first solve). */
  recordExercise(
    exerciseId: string,
    lessonId: string,
    r: { solved: boolean; usedSolution?: boolean; difficulty?: number },
  ): number;
  completeLesson(lessonId: string, opts?: { accuracy?: number }): { xp: number; newCards: number; firstTime: boolean };
  submitBoss(moduleId: string, score: number, opts?: { asSkipTest?: boolean }): { passed: boolean; xp: number; best: number };
  addToSrs(id: string, kind: SrsKind, lessonId: string, moduleId: string): void;
  gradeCard(id: string, grade: Grade): number;
  suspendCard(id: string, suspended: boolean): void;
  resolveMistake(blockId: string): void;
  /** Saves the learner's "Neden yanıldım?" note on a mistakes-notebook entry. */
  setMistakeNote(blockId: string, note: string): void;
  setNote(lessonId: string, text: string): void;
  setReflection(blockId: string, text: string, rating?: 1 | 2 | 3): number;
  unlockAchievement(id: string): boolean;
  addStudyTime(seconds: number): void;
  exportData(): string;
  importData(json: string): boolean;
  resetAll(): void;
}

export type ProgressState = ProgressData & ProgressActions;

const defaultSettings: Settings = {
  theme: 'dark',
  runner: 'auto',
  sound: true,
  reducedMotion: false,
  editorFontSize: 14,
  contentScale: 1,
  dailyGoalXp: 100,
  newCardsPerDay: 30,
  showConfidence: true,
  freeMode: false,
};

function initialData(): ProgressData {
  return {
    profile: { name: '', createdAt: nowIso(), onboarded: false },
    settings: { ...defaultSettings },
    xp: 0,
    activity: {},
    streak: { current: 0, best: 0, lastDay: null, freezes: 0, frozenDays: [] },
    lessons: {},
    blocks: {},
    exercises: {},
    modules: {},
    srs: {},
    reviewLog: [],
    mistakes: {},
    notes: {},
    reflections: {},
    achievements: {},
    recentXp: [],
    lastLessonId: undefined,
    totalSeconds: 0,
  };
}

const emptyDay = (): DayActivity => ({ xp: 0, lessons: 0, reviews: 0, checks: 0, exercises: 0, seconds: 0 });

// ------------------------------------------------------------------ store

export const useProgress = create<ProgressState>()(
  persist(
    (set, get) => {
      /** Updates today's activity counters + streak. */
      const bumpDay = (patch: Partial<Record<keyof DayActivity, number>>) => {
        const today = dayKey();
        set((s) => {
          const day = { ...emptyDay(), ...s.activity[today] };
          for (const [k, v] of Object.entries(patch)) (day as unknown as Record<string, number>)[k] += v ?? 0;
          // streak
          const st = { ...s.streak };
          if (st.lastDay !== today) {
            const yesterday = addDays(today, -1);
            if (st.lastDay === yesterday) st.current += 1;
            else if (st.lastDay === addDays(today, -2) && st.freezes > 0) {
              st.freezes -= 1;
              st.frozenDays = [...st.frozenDays, yesterday].slice(-30);
              st.current += 1;
            } else st.current = 1;
            st.lastDay = today;
            st.best = Math.max(st.best, st.current);
            if (st.current > 0 && st.current % 7 === 0) st.freezes = Math.min(2, st.freezes + 1);
          }
          return { activity: { ...s.activity, [today]: day }, streak: st };
        });
      };

      const addXp = (amount: number, reason: string): number => {
        if (amount <= 0) return 0;
        bumpDay({ xp: amount });
        set((s) => ({
          xp: s.xp + amount,
          recentXp: [{ at: nowIso(), amount, reason }, ...s.recentXp].slice(0, 100),
        }));
        // daily goal bonus (once per day)
        const today = dayKey();
        const s = get();
        const day = s.activity[today];
        if (day && !day.goalBonus && day.xp >= s.settings.dailyGoalXp) {
          set((st) => ({
            activity: { ...st.activity, [today]: { ...st.activity[today], goalBonus: true, xp: st.activity[today].xp + XP.dailyGoalBonus } },
            xp: st.xp + XP.dailyGoalBonus,
            recentXp: [{ at: nowIso(), amount: XP.dailyGoalBonus, reason: 'Günlük hedef tamamlandı!' }, ...st.recentXp].slice(0, 100),
          }));
          return amount + XP.dailyGoalBonus;
        }
        return amount;
      };

      const addToSrs = (id: string, kind: SrsKind, lessonId: string, moduleId: string) => {
        if (get().srs[id]) return;
        set((s) => ({
          srs: { ...s.srs, [id]: { id, kind, lessonId, moduleId, addedAt: nowIso(), card: newCard() } },
        }));
      };

      return {
        ...initialData(),

        completeOnboarding: (p) => set((s) => ({ profile: { ...s.profile, ...p, onboarded: true } })),
        updateProfile: (p) => set((s) => ({ profile: { ...s.profile, ...p } })),
        updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
        addXp,

        startLesson: (lessonId) =>
          set((s) => {
            const existing = s.lessons[lessonId];
            return {
              lastLessonId: lessonId,
              lessons: existing
                ? s.lessons
                : { ...s.lessons, [lessonId]: { status: 'in_progress', step: 0, startedAt: nowIso(), completions: 0 } },
            };
          }),

        setLessonStep: (lessonId, step) =>
          set((s) => {
            const lp = s.lessons[lessonId];
            if (!lp) return {};
            return { lessons: { ...s.lessons, [lessonId]: { ...lp, step: Math.max(lp.step, step) } } };
          }),

        recordBlock: (blockId, lessonId, r) => {
          const prev = get().blocks[blockId];
          const firstTry = prev ? prev.firstTry : r.correct;
          const lesson = getLesson(lessonId);
          const moduleId = lesson?.moduleId ?? '';
          set((s) => ({
            blocks: {
              ...s.blocks,
              [blockId]: {
                correct: r.correct,
                firstTry,
                attempts: (prev?.attempts ?? 0) + 1,
                confidence: r.confidence ?? prev?.confidence,
                at: nowIso(),
                answer: r.answer,
              },
            },
          }));
          bumpDay({ checks: 1 });
          // mistakes notebook + resurfacing in spaced repetition
          if (!r.correct) {
            set((s) => {
              const m = s.mistakes[blockId];
              return {
                mistakes: {
                  ...s.mistakes,
                  [blockId]: { ...m, blockId, lessonId, moduleId, count: (m?.count ?? 0) + 1, lastAt: nowIso(), resolved: false, resolvedAt: undefined },
                },
              };
            });
            if (r.context !== 'review') addToSrs(blockId, 'check', lessonId, moduleId);
          } else if (r.confidence === 1 && r.context !== 'review') {
            addToSrs(blockId, 'check', lessonId, moduleId); // lucky guess: practice again later
          }
          let xp = 0;
          if (r.correct && !prev) xp = XP.checkFirstTry;
          else if (r.correct && prev && !prev.correct) xp = XP.checkLater;
          if (r.context === 'review' || r.context === 'practice') xp = r.correct ? XP.checkLater : 0;
          return { xp: addXp(xp, 'Doğru cevap'), firstTry };
        },

        setBlockConfidence: (blockId, confidence) =>
          set((s) => (s.blocks[blockId] ? { blocks: { ...s.blocks, [blockId]: { ...s.blocks[blockId], confidence } } } : {})),

        saveExerciseCode: (exerciseId, code) =>
          set((s) => {
            const e = s.exercises[exerciseId] ?? { solved: false, attempts: 0, hintsUsed: 0, usedSolution: false };
            return { exercises: { ...s.exercises, [exerciseId]: { ...e, code } } };
          }),

        useHint: (exerciseId) =>
          set((s) => {
            const e = s.exercises[exerciseId] ?? { solved: false, attempts: 0, hintsUsed: 0, usedSolution: false };
            return { exercises: { ...s.exercises, [exerciseId]: { ...e, hintsUsed: e.hintsUsed + 1 } } };
          }),

        recordExercise: (exerciseId, lessonId, r) => {
          const prev = get().exercises[exerciseId] ?? { solved: false, attempts: 0, hintsUsed: 0, usedSolution: false };
          const firstSolve = r.solved && !prev.solved;
          const usedSolution = prev.usedSolution || !!r.usedSolution;
          set((s) => ({
            exercises: {
              ...s.exercises,
              [exerciseId]: {
                ...prev,
                attempts: prev.attempts + (r.usedSolution ? 0 : 1),
                solved: prev.solved || r.solved,
                usedSolution,
                solvedAt: firstSolve ? nowIso() : prev.solvedAt,
              },
            },
          }));
          if (!firstSolve) return 0;
          bumpDay({ exercises: 1 });
          const lesson = getLesson(lessonId);
          if (lesson) {
            const m = get().mistakes[exerciseId];
            if (m) set((s) => ({ mistakes: { ...s.mistakes, [exerciseId]: { ...m, resolved: true } } }));
          }
          const amount = usedSolution
            ? XP.exerciseWithSolution
            : Math.max(10, XP.exerciseBase + XP.exercisePerDifficulty * (r.difficulty ?? 2) - XP.exerciseHintPenalty * prev.hintsUsed);
          return addXp(amount, 'Alıştırma çözüldü');
        },

        completeLesson: (lessonId, opts) => {
          const lesson = getLesson(lessonId);
          if (!lesson) return { xp: 0, newCards: 0, firstTime: false };
          const prev = get().lessons[lessonId];
          const firstTime = prev?.status !== 'completed';
          set((s) => ({
            lessons: {
              ...s.lessons,
              [lessonId]: {
                status: 'completed',
                step: Math.max(prev?.step ?? 0, lesson.steps.length - 1),
                startedAt: prev?.startedAt ?? nowIso(),
                completedAt: nowIso(),
                completions: (prev?.completions ?? 0) + 1,
                accuracy: opts?.accuracy ?? prev?.accuracy,
              },
            },
          }));
          let newCards = 0;
          for (const card of lessonFlashcards(lesson)) {
            if (!get().srs[card.id]) {
              addToSrs(card.id, 'flashcard', lesson.id, lesson.moduleId);
              newCards++;
            }
          }
          if (firstTime) bumpDay({ lessons: 1 });
          const amount = firstTime ? (lesson.type === 'project' ? XP.projectComplete : XP.lessonComplete) : XP.lessonRepeat;
          return { xp: addXp(amount, `Ders tamamlandı: ${lesson.title}`), newCards, firstTime };
        },

        submitBoss: (moduleId, score, opts) => {
          const prev = get().modules[moduleId] ?? { bossBest: 0, bossAttempts: 0, bossPassed: false };
          const passed = score >= BOSS_PASS_THRESHOLD;
          const firstPass = passed && !prev.bossPassed;
          const best = Math.max(prev.bossBest, score);
          set((s) => ({
            modules: {
              ...s.modules,
              [moduleId]: {
                ...prev,
                bossBest: best,
                bossAttempts: prev.bossAttempts + 1,
                bossPassed: prev.bossPassed || passed,
                skipUnlocked: prev.skipUnlocked || (!!opts?.asSkipTest && passed),
                masteredAt: firstPass ? nowIso() : prev.masteredAt,
              },
            },
          }));
          let amount = 0;
          if (firstPass) amount = XP.bossPass + (score >= 1 ? XP.bossPerfectBonus : 0);
          else if (passed) amount = XP.bossRepeatPass;
          return { passed, xp: addXp(amount, `Modül sınavı: ${getModule(moduleId)?.title ?? moduleId}`), best };
        },

        addToSrs,

        gradeCard: (id, grade) => {
          const entry = get().srs[id];
          if (!entry) return 0;
          set((s) => ({
            srs: { ...s.srs, [id]: { ...entry, card: reviewCard(entry.card, grade) } },
            reviewLog: [...s.reviewLog, { id, at: nowIso(), grade }].slice(-5000),
          }));
          bumpDay({ reviews: 1 });
          return addXp(grade === 1 ? XP.reviewAgain : XP.review, 'Tekrar');
        },

        suspendCard: (id, suspended) =>
          set((s) => (s.srs[id] ? { srs: { ...s.srs, [id]: { ...s.srs[id], suspended } } } : {})),

        resolveMistake: (blockId) =>
          set((s) =>
            s.mistakes[blockId] && !s.mistakes[blockId].resolved
              ? { mistakes: { ...s.mistakes, [blockId]: { ...s.mistakes[blockId], resolved: true, resolvedAt: nowIso() } } }
              : {},
          ),

        setMistakeNote: (blockId, note) =>
          set((s) => (s.mistakes[blockId] ? { mistakes: { ...s.mistakes, [blockId]: { ...s.mistakes[blockId], note } } } : {})),

        setNote: (lessonId, text) => set((s) => ({ notes: { ...s.notes, [lessonId]: text } })),

        setReflection: (blockId, text, rating) => {
          const prev = get().reflections[blockId];
          set((s) => ({ reflections: { ...s.reflections, [blockId]: { text, rating, at: nowIso() } } }));
          return prev ? 0 : addXp(XP.reflect, 'Kendi cümlelerinle açıkladın');
        },

        unlockAchievement: (id) => {
          if (get().achievements[id]) return false;
          set((s) => ({ achievements: { ...s.achievements, [id]: nowIso() } }));
          return true;
        },

        addStudyTime: (seconds) => {
          if (seconds <= 0) return;
          const today = dayKey();
          set((s) => {
            const day = { ...emptyDay(), ...s.activity[today] };
            day.seconds += seconds;
            return { activity: { ...s.activity, [today]: day }, totalSeconds: s.totalSeconds + seconds };
          });
        },

        exportData: () => {
          const s = get();
          const data: Record<string, unknown> = {};
          for (const k of Object.keys(initialData())) data[k] = (s as unknown as Record<string, unknown>)[k];
          return JSON.stringify({ app: 'rusteach', version: 1, exportedAt: nowIso(), data }, null, 2);
        },

        importData: (json) => {
          try {
            const parsed = JSON.parse(json);
            if (parsed?.app !== 'rusteach' || !parsed.data) return false;
            set({ ...initialData(), ...parsed.data, settings: { ...defaultSettings, ...parsed.data.settings } });
            return true;
          } catch {
            return false;
          }
        },

        resetAll: () => set(initialData()),
      };
    },
    {
      name: 'rusteach-progress',
      version: 1,
      storage: createJSONStorage(() => localStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressData>;
        return { ...current, ...p, settings: { ...defaultSettings, ...p.settings } } as ProgressState;
      },
    },
  ),
);

// ------------------------------------------------------------------ derived selectors (pure)

export type ModuleStatus = 'locked' | 'available' | 'in_progress' | 'completed' | 'mastered';
export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export function isModuleUnlocked(s: ProgressData, m: Module): boolean {
  if (s.settings.freeMode) return true;
  const idx = modules.indexOf(m);
  if (idx <= 0) return true;
  const mp = s.modules[m.id];
  if (mp?.bossPassed || mp?.skipUnlocked) return true;
  if (m.lessonIds.some((id) => s.lessons[id])) return true; // already started
  const prev = modules[idx - 1];
  return !!s.modules[prev.id]?.bossPassed;
}

export function moduleStatus(s: ProgressData, m: Module): ModuleStatus {
  if (s.modules[m.id]?.bossPassed) return 'mastered';
  if (!isModuleUnlocked(s, m)) return 'locked';
  const done = m.lessonIds.filter((id) => s.lessons[id]?.status === 'completed').length;
  if (m.lessonIds.length && done === m.lessonIds.length) return 'completed';
  if (m.lessonIds.some((id) => s.lessons[id])) return 'in_progress';
  return 'available';
}

/** 0..1 - lessons completed (+ boss counts as one extra unit). */
export function moduleProgress(s: ProgressData, m: Module): number {
  const units = m.lessonIds.length + (m.bossId ? 1 : 0);
  if (!units) return 0;
  const done =
    m.lessonIds.filter((id) => s.lessons[id]?.status === 'completed').length + (s.modules[m.id]?.bossPassed ? 1 : 0);
  return done / units;
}

export function lessonStatus(s: ProgressData, lessonId: string): LessonStatus {
  const lesson = getLesson(lessonId);
  if (!lesson) return 'locked';
  const lp = s.lessons[lessonId];
  if (lp?.status === 'completed') return 'completed';
  if (lp) return 'in_progress';
  const m = getModule(lesson.moduleId);
  if (!m || !isModuleUnlocked(s, m)) return 'locked';
  if (s.settings.freeMode) return 'available';
  if (lesson.type === 'boss') {
    return m.lessonIds.every((id) => s.lessons[id]?.status === 'completed') ? 'available' : 'locked';
  }
  const idx = m.lessonIds.indexOf(lessonId);
  if (idx <= 0) return 'available';
  return s.lessons[m.lessonIds[idx - 1]]?.status === 'completed' ? 'available' : 'locked';
}

/** A locked module whose previous module is unlocked can be skipped by passing its boss. */
export function canTakeSkipTest(s: ProgressData, m: Module): boolean {
  if (isModuleUnlocked(s, m) || !m.bossId) return false;
  const idx = modules.indexOf(m);
  return idx > 0 && isModuleUnlocked(s, modules[idx - 1]);
}

/** The lesson the learner should do next (continue in-progress first, then first available). */
export function nextLessonId(s: ProgressData): string | undefined {
  if (s.lastLessonId && s.lessons[s.lastLessonId]?.status === 'in_progress') return s.lastLessonId;
  for (const m of modules) {
    if (!isModuleUnlocked(s, m)) continue;
    for (const l of moduleLessons(m)) if (s.lessons[l.id]?.status !== 'completed') return l.id;
    if (m.bossId && !s.modules[m.id]?.bossPassed) return m.bossId;
  }
  return undefined;
}

/** Due review entries (excluding suspended), oldest due first; new cards limited per day. */
export function dueReviews(s: ProgressData, now: Date = new Date()): SrsEntry[] {
  const all = Object.values(s.srs).filter((e) => !e.suspended && isDue(e.card, now) && sourceExists(e));
  const reviewed = all.filter((e) => e.card.state !== 0);
  const fresh = all.filter((e) => e.card.state === 0);
  const today = dayKey(now);
  const introducedToday = s.reviewLog.filter((r) => r.at.startsWith(today) && s.srs[r.id]?.card.reps === 1).length;
  const freshAllowed = Math.max(0, s.settings.newCardsPerDay - introducedToday);
  return [
    ...reviewed.sort((a, b) => a.card.due.localeCompare(b.card.due)),
    ...fresh.sort((a, b) => a.addedAt.localeCompare(b.addedAt)).slice(0, freshAllowed),
  ];
}

function sourceExists(e: SrsEntry): boolean {
  return e.kind === 'check' ? !!findBlock(e.id) : !!getLesson(e.lessonId);
}

export function todayActivity(s: ProgressData): DayActivity {
  return { ...emptyDay(), ...s.activity[dayKey()] };
}

/** First-try accuracy over all answered checks of a module (null when nothing answered). */
export function moduleAccuracy(s: ProgressData, moduleId: string): number | null {
  let n = 0;
  let ok = 0;
  for (const [id, r] of Object.entries(s.blocks)) {
    const loc = findBlock(id);
    if (!loc || loc.module.id !== moduleId) continue;
    n++;
    if (r.firstTry) ok++;
  }
  return n ? ok / n : null;
}
