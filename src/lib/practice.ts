// Selection algorithms of the learning engine: interleaving, weak-spot weighted sampling, the review
// queue, the speed round, the mistakes notebook and the exercise catalog.
//
// Pure functions over ProgressData + content. Randomness only comes from an explicit numeric seed
// (mulberry32), so the same seed always yields the same session - easy to unit test.
import type { ExerciseProgress, MistakeEntry, ProgressData, SrsEntry, SrsKind } from '../store/progress';
import type { Block, ExerciseBlock, Lesson, Module } from '../types/content';
import { allBlocks, findBlock, findFlashcard, isCheck, moduleLessons, modules } from './content';
import { retrievability } from './srs';

const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ seeded randomness

/** Small deterministic PRNG (mulberry32). Same seed → same sequence of numbers in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle into a new array. */
export function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Weighted sampling without replacement (Efraimidis–Spirakis): key = u^(1/w), keep the n largest. */
export function weightedSample<T>(items: readonly T[], weight: (t: T) => number, n: number, rand: () => number): T[] {
  if (n <= 0) return [];
  return items
    .map((it) => ({ it, key: Math.pow(rand(), 1 / Math.max(1e-6, weight(it))) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.it);
}

// ------------------------------------------------------------------ interleaving

/**
 * Interleaving: reorders items so that no two consecutive items share a `group` (e.g. the same lesson)
 * whenever that is possible and - as a softer preference - not the same `family` (module) either.
 * Within a group the incoming priority order is kept. Picking the group with the most remaining
 * items (that is not the previous one) is optimal for the adjacency constraint; ties are broken by a
 * family change, then by the seeded random.
 */
export function interleave<T>(
  items: readonly T[],
  group: (t: T) => string,
  rand: () => number,
  family?: (t: T) => string,
): T[] {
  const buckets = new Map<string, T[]>();
  for (const it of items) {
    const key = group(it);
    const list = buckets.get(key);
    if (list) list.push(it);
    else buckets.set(key, [it]);
  }
  const out: T[] = [];
  let lastGroup: string | undefined;
  let lastFamily: string | undefined;
  while (out.length < items.length) {
    let best: string | undefined;
    let bestScore = -Infinity;
    for (const [key, list] of buckets) {
      if (!list.length) continue;
      let score = list.length * 4;
      if (key === lastGroup) score -= 10_000;
      if (family && family(list[0]) !== lastFamily) score += 2;
      score += rand();
      if (score > bestScore) {
        bestScore = score;
        best = key;
      }
    }
    const item = buckets.get(best!)!.shift()!;
    out.push(item);
    lastGroup = best;
    lastFamily = family?.(item);
  }
  return out;
}

/** Number of adjacent pairs that share a group - 0 means perfectly interleaved. */
export function adjacencyCount<T>(items: readonly T[], group: (t: T) => string): number {
  let n = 0;
  for (let i = 1; i < items.length; i++) if (group(items[i]) === group(items[i - 1])) n++;
  return n;
}

/**
 * Where to re-insert an item the learner just failed ("Tekrar"), so it comes back a few cards later
 * without landing next to a card of the same lesson (successive relearning inside the session).
 */
export function requeueIndex<T>(
  queue: readonly T[],
  current: number,
  item: T,
  group: (t: T) => string,
  minGap = 3,
  maxGap = 6,
): number {
  const g = group(item);
  const first = Math.min(queue.length, current + 1 + minGap);
  const last = Math.min(queue.length, current + 1 + maxGap);
  for (let pos = first; pos <= last; pos++) {
    const prev = queue[pos - 1];
    const next = queue[pos];
    if ((!prev || group(prev) !== g) && (!next || group(next) !== g)) return pos;
  }
  return first;
}

// ------------------------------------------------------------------ review queue

/** Seconds a typical item takes - used for "≈ N dakika" estimates. */
export const ITEM_SECONDS: Record<SrsKind, number> = { flashcard: 12, check: 40 };

export function estimateMinutes(entries: readonly { kind: SrsKind }[]): number {
  const seconds = entries.reduce((sum, e) => sum + ITEM_SECONDS[e.kind], 0);
  return Math.max(1, Math.round(seconds / 60));
}

/**
 * Builds an interleaved review session: takes the first `size` due entries (dueReviews order = most
 * overdue first, then new cards) and mixes them so that consecutive items come from different lessons.
 */
export function buildReviewQueue(due: readonly SrsEntry[], size: number | 'all', seed: number): SrsEntry[] {
  const picked = size === 'all' ? [...due] : due.slice(0, size);
  return interleave(picked, (e) => e.lessonId, mulberry32(seed), (e) => e.moduleId);
}

// ------------------------------------------------------------------ practice candidates

export type PracticeKind = 'check' | 'exercise';

export interface PracticeItem {
  id: string; // block id
  kind: PracticeKind;
  blockType: Block['type'];
  lessonId: string;
  moduleId: string;
  /** Relative sampling weight (≥ 1); higher = weaker spot. */
  weight: number;
  /** Why the item was chosen (Turkish, most important first). */
  reasons: string[];
}

/** Completed regular/project lessons in curriculum order (bosses excluded - they stay tests). */
export function completedLessons(s: ProgressData): Lesson[] {
  const out: Lesson[] = [];
  for (const m of modules) for (const l of moduleLessons(m)) if (s.lessons[l.id]?.status === 'completed') out.push(l);
  return out;
}

export interface PracticeModule {
  module: Module;
  lessons: number;
  checks: number;
  exercises: number;
}

/** Modules that have at least one completed lesson, with the amount of practice material in them. */
export function practiceModules(s: ProgressData): PracticeModule[] {
  const map = new Map<string, PracticeModule>();
  for (const lesson of completedLessons(s)) {
    const m = modules.find((x) => x.id === lesson.moduleId);
    if (!m) continue;
    const pm = map.get(m.id) ?? { module: m, lessons: 0, checks: 0, exercises: 0 };
    pm.lessons += 1;
    for (const b of allBlocks(lesson)) {
      if (isCheck(b)) pm.checks += 1;
      else if (b.type === 'exercise') pm.exercises += 1;
    }
    map.set(m.id, pm);
  }
  return modules.map((m) => map.get(m.id)).filter((x): x is PracticeModule => !!x);
}

interface Weakness {
  weight: number;
  reasons: string[];
}

function finish(parts: [number, string][]): Weakness {
  parts.sort((a, b) => b[0] - a[0]);
  return { weight: 1 + parts.reduce((sum, p) => sum + p[0], 0), reasons: parts.map((p) => p[1]) };
}

function daysSince(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : Math.max(0, (now.getTime() - t) / DAY_MS);
}

/** How much a check needs practice: wrong first try, open mistakes, fading memory, not seen lately. */
export function checkWeakness(s: ProgressData, blockId: string, now: Date = new Date()): Weakness {
  const r = s.blocks[blockId];
  const m = s.mistakes[blockId];
  const e = s.srs[blockId];
  const parts: [number, string][] = [];
  if (m && !m.resolved) parts.push([2.5 + Math.min(1.5, (m.count - 1) * 0.5), m.count > 1 ? `${m.count} kez yanıldın` : 'Hata defterinde']);
  if (r && !r.firstTry) parts.push([1.5, 'İlk denemede yanlış']);
  if (r && !r.correct && r.confidence === 3) parts.push([1, 'Emindin ama yanıldın']);
  if (r && r.correct && r.confidence === 1) parts.push([0.7, 'Tahminle bilmiştin']);
  if (e && e.card.state !== 0) {
    const R = retrievability(e.card, now);
    if (R < 0.85) parts.push([(1 - R) * 3, 'Unutulmaya yakın']);
  }
  const days = daysSince(r?.at, now);
  if (!r) parts.push([0.8, 'Henüz cevaplamadın']);
  else if (days !== null && days >= 7) parts.push([Math.min(2, days / 7), `${Math.floor(days)} gündür görmedin`]);
  return finish(parts);
}

/** How much an exercise needs practice: unsolved, solution revealed, hints used, solved long ago. */
export function exerciseWeakness(s: ProgressData, exerciseId: string, now: Date = new Date()): Weakness {
  const p = s.exercises[exerciseId];
  const parts: [number, string][] = [];
  if (!p || !p.solved) parts.push([2, p?.attempts ? 'Henüz çözülmedi' : 'Henüz denemedin']);
  if (p?.usedSolution) parts.push([1.5, 'Çözümüne bakmıştın']);
  if (p?.hintsUsed) parts.push([Math.min(1, p.hintsUsed * 0.3), 'İpucu kullanmıştın']);
  const days = daysSince(p?.solvedAt, now);
  if (days !== null && days >= 10) parts.push([Math.min(2, days / 10), `${Math.floor(days)} gündür çözmedin`]);
  return finish(parts);
}

export interface CandidateOptions {
  moduleIds?: readonly string[];
  includeExercises?: boolean;
  now?: Date;
}

/** Every check (and optionally exercise) of the completed lessons, with its weak-spot weight. */
export function practiceCandidates(s: ProgressData, opts: CandidateOptions = {}): PracticeItem[] {
  const now = opts.now ?? new Date();
  const out: PracticeItem[] = [];
  for (const lesson of completedLessons(s)) {
    if (opts.moduleIds && !opts.moduleIds.includes(lesson.moduleId)) continue;
    for (const b of allBlocks(lesson)) {
      if (isCheck(b)) {
        const w = checkWeakness(s, b.id, now);
        out.push({ id: b.id, kind: 'check', blockType: b.type, lessonId: lesson.id, moduleId: lesson.moduleId, ...w });
      } else if (b.type === 'exercise' && opts.includeExercises) {
        const w = exerciseWeakness(s, b.id, now);
        out.push({ id: b.id, kind: 'exercise', blockType: b.type, lessonId: lesson.id, moduleId: lesson.moduleId, ...w });
      }
    }
  }
  return out;
}

export interface PracticeSetOptions extends CandidateOptions {
  size: number;
  seed: number;
}

/**
 * "Karma antrenman": a weighted (toward weak spots), interleaved set of checks - plus about one
 * exercise in five when exercises are included. Deterministic for a given seed.
 */
export function buildPracticeSet(s: ProgressData, opts: PracticeSetOptions): PracticeItem[] {
  const rand = mulberry32(opts.seed);
  const all = practiceCandidates(s, opts);
  const checks = all.filter((i) => i.kind === 'check');
  const exercises = all.filter((i) => i.kind === 'exercise');
  const exerciseSlots = opts.includeExercises ? Math.min(exercises.length, Math.max(1, Math.round(opts.size * 0.2))) : 0;
  const pickedExercises = weightedSample(exercises, (i) => i.weight, exerciseSlots, rand);
  let picked = [...weightedSample(checks, (i) => i.weight, opts.size - pickedExercises.length, rand), ...pickedExercises];
  if (picked.length < opts.size && opts.includeExercises) {
    const rest = exercises.filter((e) => !pickedExercises.includes(e));
    picked = [...picked, ...weightedSample(rest, (i) => i.weight, opts.size - picked.length, rand)];
  }
  return interleave(picked, (i) => i.lessonId, rand, (i) => i.moduleId);
}

export interface WeakSpotSummary {
  total: number;
  openMistakes: number;
  fading: number;
  wrongFirst: number;
  unsolved: number;
}

export function weakSpotSummary(items: readonly PracticeItem[]): WeakSpotSummary {
  const has = (i: PracticeItem, prefix: string) => i.reasons.some((r) => r.includes(prefix));
  return {
    total: items.length,
    // "N kez yanıldın" / "Hata defterinde" mark open mistakes ("Emindin ama yanıldın" does not).
    openMistakes: items.filter((i) => i.reasons.some((r) => r === 'Hata defterinde' || /^\d+ kez yanıldın$/.test(r))).length,
    fading: items.filter((i) => has(i, 'Unutulmaya')).length,
    wrongFirst: items.filter((i) => has(i, 'İlk denemede')).length,
    unsolved: items.filter((i) => i.kind === 'exercise' && (has(i, 'çözülmedi') || has(i, 'denemedin'))).length,
  };
}

// ------------------------------------------------------------------ speed round

export const SPEED_ROUND = { size: 10, seconds: 180, pointsPerCorrect: 100, pointsPerSecondLeft: 2, minItems: 3 } as const;

/** Checks that can be answered in a few seconds (no typing, no ordering). */
export function isQuickCheck(b: Block): boolean {
  if (b.type === 'quiz' || b.type === 'compiles') return true;
  if (b.type === 'predict') return !!b.options?.length;
  return false;
}

export function speedRoundPool(s: ProgressData, now: Date = new Date()): PracticeItem[] {
  return practiceCandidates(s, { now }).filter((i) => {
    const b = findBlock(i.id)?.block;
    return !!b && isQuickCheck(b);
  });
}

/** Ten quick checks, mildly weighted toward weak spots, interleaved across lessons. */
export function speedRoundSet(s: ProgressData, seed: number, now: Date = new Date()): PracticeItem[] {
  const rand = mulberry32(seed);
  const picked = weightedSample(speedRoundPool(s, now), (i) => Math.sqrt(i.weight), SPEED_ROUND.size, rand);
  return interleave(picked, (i) => i.lessonId, rand, (i) => i.moduleId);
}

export function speedRoundScore(correct: number, secondsLeft: number, finishedAll: boolean): { base: number; bonus: number; total: number } {
  const base = correct * SPEED_ROUND.pointsPerCorrect;
  const bonus = finishedAll ? Math.max(0, Math.round(secondsLeft)) * SPEED_ROUND.pointsPerSecondLeft : 0;
  return { base, bonus, total: base + bonus };
}

// ------------------------------------------------------------------ mistakes notebook

export interface MistakeLessonGroup {
  lesson: Lesson;
  items: MistakeEntry[];
}

export interface MistakeModuleGroup {
  module: Module;
  lessons: MistakeLessonGroup[];
  count: number;
}

/** Mistakes (open or resolved) grouped by module → lesson in curriculum order, newest first inside. */
export function mistakeGroups(s: ProgressData, resolved: boolean): MistakeModuleGroup[] {
  const byLesson = new Map<string, { lesson: Lesson; module: Module; items: MistakeEntry[] }>();
  for (const m of Object.values(s.mistakes)) {
    if (!!m.resolved !== resolved) continue;
    const loc = findBlock(m.blockId);
    if (!loc) continue;
    const g = byLesson.get(loc.lesson.id) ?? { lesson: loc.lesson, module: loc.module, items: [] };
    g.items.push(m);
    byLesson.set(loc.lesson.id, g);
  }
  const groups: MistakeModuleGroup[] = [];
  for (const module of modules) {
    const lessons = [...byLesson.values()]
      .filter((g) => g.module.id === module.id)
      .sort((a, b) => a.lesson.index - b.lesson.index)
      .map((g) => ({ lesson: g.lesson, items: [...g.items].sort((a, b) => b.lastAt.localeCompare(a.lastAt)) }));
    if (lessons.length) groups.push({ module, lessons, count: lessons.reduce((n, l) => n + l.items.length, 0) });
  }
  return groups;
}

export function openMistakeCount(s: ProgressData): number {
  let n = 0;
  for (const m of Object.values(s.mistakes)) if (!m.resolved && findBlock(m.blockId)) n++;
  return n;
}

/** Every open mistake as a practice item, interleaved - for "Hepsini sırayla dene". */
export function mistakeSession(s: ProgressData, seed: number, now: Date = new Date()): PracticeItem[] {
  const items: PracticeItem[] = [];
  for (const group of mistakeGroups(s, false))
    for (const lg of group.lessons)
      for (const m of lg.items) {
        const b = findBlock(m.blockId)?.block;
        if (!b || (!isCheck(b) && b.type !== 'exercise')) continue;
        const w = b.type === 'exercise' ? exerciseWeakness(s, b.id, now) : checkWeakness(s, b.id, now);
        items.push({ id: b.id, kind: b.type === 'exercise' ? 'exercise' : 'check', blockType: b.type, lessonId: m.lessonId, moduleId: m.moduleId, ...w });
      }
  return interleave(items, (i) => i.lessonId, mulberry32(seed), (i) => i.moduleId);
}

// ------------------------------------------------------------------ exercise catalog

export type ExerciseStatus = 'new' | 'tried' | 'revealed' | 'solved';

export const EXERCISE_STATUS_LABELS: Record<ExerciseStatus, string> = {
  new: 'Yeni',
  tried: 'Denendi',
  revealed: 'Çözüme bakıldı',
  solved: 'Çözüldü',
};

export function exerciseStatus(p?: ExerciseProgress): ExerciseStatus {
  if (!p) return 'new';
  if (p.usedSolution) return 'revealed';
  if (p.solved) return 'solved';
  return p.attempts > 0 ? 'tried' : 'new';
}

export interface CatalogEntry {
  block: ExerciseBlock;
  lesson: Lesson;
  module: Module;
  status: ExerciseStatus;
  progress?: ExerciseProgress;
}

/** Every exercise of the lessons the learner has started or completed, in curriculum order. */
export function exerciseCatalog(s: ProgressData): CatalogEntry[] {
  const out: CatalogEntry[] = [];
  for (const module of modules)
    for (const lesson of moduleLessons(module)) {
      if (!s.lessons[lesson.id]) continue;
      for (const b of allBlocks(lesson))
        if (b.type === 'exercise') {
          const progress = s.exercises[b.id];
          out.push({ block: b, lesson, module, status: exerciseStatus(progress), progress });
        }
    }
  return out;
}

export interface CatalogFilter {
  moduleId?: string;
  difficulties?: readonly number[];
  status?: 'all' | 'solved' | 'unsolved';
  query?: string;
}

export function filterCatalog(entries: readonly CatalogEntry[], f: CatalogFilter): CatalogEntry[] {
  const q = normalizeSearch(f.query ?? '');
  return entries.filter((e) => {
    if (f.moduleId && e.module.id !== f.moduleId) return false;
    if (f.difficulties?.length && !f.difficulties.includes(e.block.difficulty)) return false;
    if (f.status === 'solved' && e.status !== 'solved') return false;
    if (f.status === 'unsolved' && e.status === 'solved') return false;
    if (q && !normalizeSearch(`${e.block.title} ${e.lesson.title} ${htmlToText(e.block.prompt)}`).includes(q)) return false;
    return true;
  });
}

// ------------------------------------------------------------------ text helpers

export const BLOCK_TYPE_LABELS: Record<string, string> = {
  quiz: 'Çoktan seçmeli',
  predict: 'Çıktıyı tahmin et',
  compiles: 'Derlenir mi?',
  fill: 'Boşluk doldurma',
  parsons: 'Satırları sırala',
  exercise: 'Kodlama alıştırması',
  flashcard: 'Bilgi kartı',
};

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&amp;': '&', '&nbsp;': ' ' };

/** Plain text of a trusted HTML snippet (for previews and search). */
export function htmlToText(html: string): string {
  return (html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(lt|gt|quot|#39|amp|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Lowercased, Turkish-aware, diacritics-insensitive form for search. */
export function normalizeSearch(text: string): string {
  return text
    .toLocaleLowerCase('tr-TR')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

/** First "interesting" line of a code snippet (skips `fn main() {`, braces and blank lines). */
export function keyCodeLine(code: string): string | undefined {
  return code
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !/^(pub\s+)?fn\s+main\s*\(\s*\)\s*\{$/.test(l) && !/^[{}]+;?$/.test(l) && !l.startsWith('//') && !l.startsWith('use '));
}

export interface BlockPreview {
  label: string;
  text: string;
  code?: string;
}

/** Short learner-facing description of a scored block for lists (mistakes notebook, card browser). */
export function blockPreview(b: Block): BlockPreview {
  const label = BLOCK_TYPE_LABELS[b.type] ?? 'Soru';
  switch (b.type) {
    case 'quiz':
      return { label, text: htmlToText(b.question) };
    case 'predict':
      return { label, text: htmlToText(b.question) || 'Bu kod ne yazdırır?', code: keyCodeLine(b.display) };
    case 'compiles':
      return { label, text: htmlToText(b.question) || 'Bu kod derlenir mi?', code: keyCodeLine(b.display) };
    case 'fill':
      return { label, text: htmlToText(b.prompt) || 'Boşlukları doldur.', code: keyCodeLine(b.code) };
    case 'parsons':
      return { label, text: htmlToText(b.prompt) || 'Satırları doğru sıraya koy.' };
    case 'exercise':
      return { label, text: b.title };
    default:
      return { label, text: '' };
  }
}

/** Front text of an SRS entry (flashcard front or the check's question). */
export function srsEntryText(e: SrsEntry): { front: string; back?: string } {
  if (e.kind === 'flashcard') {
    const fc = findFlashcard(e.id);
    return { front: htmlToText(fc?.card.front ?? ''), back: htmlToText(fc?.card.back ?? '') };
  }
  const b = findBlock(e.id)?.block;
  if (!b) return { front: '' };
  const p = blockPreview(b);
  return { front: p.code ? `${p.text} ${p.code}` : p.text };
}
