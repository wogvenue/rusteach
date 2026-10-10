// Learning analytics — pure functions over ProgressData + content (no React, no store access), so
// every number on the statistics page can be unit tested with a hand-written ProgressData.
import { addDays, dayKey, dueReviews, type DayActivity, type ProgressData, type SrsEntry } from '../store/progress';
import type { Module } from '../types/content';
import { findBlock, getLesson, getModule, modules, totals } from './content';
import { calendarDayDiff, forgettingCurve, isLongTerm, retrievability } from './srs';

const DAY_MS = 86_400_000;

// ------------------------------------------------------------------ formatting (Turkish)

const intFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 });

export function formatNumber(n: number): string {
  return intFmt.format(Math.round(n));
}

/** 0.92 → "%92" (Turkish puts the sign first). */
export function formatPercent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return '—';
  return `%${(ratio * 100).toLocaleString('tr-TR', { maximumFractionDigits: digits, minimumFractionDigits: 0 })}`;
}

/** 8100 → "2 sa 15 dk", 2700 → "45 dk", 40 → "40 sn". */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s} sn`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} dk`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} sa ${m} dk` : `${h} sa`;
}

/** 135 → "2:15" (clock style, for timers). */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export const MONTHS_SHORT = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
export const MONTHS_LONG = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
/** Monday-first, like Turkish calendars. */
export const WEEKDAYS_SHORT = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
export const WEEKDAYS_LONG = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday = 0 … Sunday = 6. */
export function weekdayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** "12 Eki" */
export function shortDate(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** "12 Ekim Pazartesi" */
export function longDate(key: string): string {
  const d = parseDayKey(key);
  return `${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${WEEKDAYS_LONG[weekdayIndex(d)]}`;
}

/** "bugün", "dün", "3 gün önce", "2 hafta önce", or "12 Eki" for older dates. */
export function relativeDayLabel(iso: string | undefined, now: Date = new Date()): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const days = calendarDayDiff(d, now);
  if (days <= 0) return 'bugün';
  if (days === 1) return 'dün';
  if (days < 7) return `${days} gün önce`;
  if (days < 30) return `${Math.floor(days / 7)} hafta önce`;
  return shortDate(dayKey(d));
}

const emptyDay = (): DayActivity => ({ xp: 0, lessons: 0, reviews: 0, checks: 0, exercises: 0, seconds: 0 });

function sourceExists(e: SrsEntry): boolean {
  return e.kind === 'check' ? !!findBlock(e.id) : !!getLesson(e.lessonId);
}

// ------------------------------------------------------------------ overview tiles

export interface Overview {
  xp: number;
  lessonsDone: number;
  lessonsTotal: number;
  exercisesSolved: number; // solved without revealing the solution
  exercisesTotal: number;
  answered: number; // checks answered at least once
  firstTryCorrect: number;
  firstTryAccuracy: number | null;
  studySeconds: number;
  longTermCards: number;
  activeCards: number; // SRS cards that are not suspended
  reviews: number;
}

export function overview(s: ProgressData, now: Date = new Date()): Overview {
  const lessonsDone = Object.entries(s.lessons).filter(
    ([id, lp]) => lp.status === 'completed' && getLesson(id)?.type !== 'boss',
  ).length;
  const blocks = Object.values(s.blocks);
  const firstTryCorrect = blocks.filter((b) => b.firstTry).length;
  const cards = Object.values(s.srs).filter((e) => !e.suspended && sourceExists(e));
  return {
    xp: s.xp,
    lessonsDone,
    lessonsTotal: totals.lessons,
    exercisesSolved: Object.values(s.exercises).filter((e) => e.solved && !e.usedSolution).length,
    exercisesTotal: totals.exercises,
    answered: blocks.length,
    firstTryCorrect,
    firstTryAccuracy: blocks.length ? firstTryCorrect / blocks.length : null,
    studySeconds: s.totalSeconds,
    longTermCards: cards.filter((e) => isLongTerm(e.card, now)).length,
    activeCards: cards.length,
    reviews: s.reviewLog.length,
  };
}

// ------------------------------------------------------------------ activity heatmap

export type HeatLevel = 0 | 1 | 2 | 3 | 4;

export interface HeatDay {
  key: string;
  activity: DayActivity;
  level: HeatLevel;
  future: boolean;
  today: boolean;
}

export interface HeatmapData {
  weeks: HeatDay[][]; // columns (oldest first), each Monday → Sunday
  monthLabels: { week: number; label: string }[];
  activeDays: number;
  totalXp: number;
  goalDays: number;
  best?: HeatDay;
}

/** Levels follow the daily goal: <½ goal, <goal, <2× goal, ≥2× goal. */
export function heatLevel(xp: number, goal: number): HeatLevel {
  if (xp <= 0) return 0;
  const g = Math.max(1, goal);
  if (xp < g * 0.5) return 1;
  if (xp < g) return 2;
  if (xp < g * 2) return 3;
  return 4;
}

export function activityHeatmap(s: ProgressData, weeks = 26, today: Date = new Date()): HeatmapData {
  const todayKey = dayKey(today);
  const start = addDays(todayKey, -weekdayIndex(today) - (weeks - 1) * 7);
  const goal = s.settings.dailyGoalXp;
  const cols: HeatDay[][] = [];
  const monthLabels: { week: number; label: string }[] = [];
  let activeDays = 0;
  let totalXp = 0;
  let goalDays = 0;
  let best: HeatDay | undefined;
  for (let w = 0; w < weeks; w++) {
    const col: HeatDay[] = [];
    for (let d = 0; d < 7; d++) {
      const key = addDays(start, w * 7 + d);
      const activity = { ...emptyDay(), ...s.activity[key] };
      const day: HeatDay = { key, activity, level: heatLevel(activity.xp, goal), future: key > todayKey, today: key === todayKey };
      if (!day.future && (activity.xp > 0 || activity.seconds > 0)) activeDays++;
      if (!day.future) {
        totalXp += activity.xp;
        if (activity.xp >= goal) goalDays++;
        if (activity.xp > 0 && (!best || activity.xp > best.activity.xp)) best = day;
      }
      if (parseDayKey(key).getDate() === 1) monthLabels.push({ week: w, label: MONTHS_SHORT[parseDayKey(key).getMonth()] });
      col.push(day);
    }
    cols.push(col);
  }
  // Label the first column with its month unless a month starts within the next three weeks.
  if (!monthLabels.length || monthLabels[0].week > 2) {
    monthLabels.unshift({ week: 0, label: MONTHS_SHORT[parseDayKey(start).getMonth()] });
  }
  return { weeks: cols, monthLabels, activeDays, totalXp, goalDays, best };
}

// ------------------------------------------------------------------ XP per day

export interface XpDay {
  key: string;
  label: string; // "12 Eki"
  weekday: string; // "Pzt"
  xp: number;
  goalMet: boolean;
  isToday: boolean;
}

export function xpByDay(s: ProgressData, days = 30, today: Date = new Date()): XpDay[] {
  const todayKey = dayKey(today);
  const out: XpDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = addDays(todayKey, -i);
    const xp = s.activity[key]?.xp ?? 0;
    out.push({
      key,
      label: shortDate(key),
      weekday: WEEKDAYS_SHORT[weekdayIndex(parseDayKey(key))],
      xp,
      goalMet: xp >= s.settings.dailyGoalXp,
      isToday: i === 0,
    });
  }
  return out;
}

/** XP earned in the last `days` days vs the `days` before (for "this week vs last week"). */
export function xpTrend(s: ProgressData, days = 7, today: Date = new Date()): { current: number; previous: number; change: number | null } {
  const todayKey = dayKey(today);
  let current = 0;
  let previous = 0;
  for (let i = 0; i < days; i++) current += s.activity[addDays(todayKey, -i)]?.xp ?? 0;
  for (let i = days; i < days * 2; i++) previous += s.activity[addDays(todayKey, -i)]?.xp ?? 0;
  return { current, previous, change: previous > 0 ? (current - previous) / previous : null };
}

// ------------------------------------------------------------------ per-module accuracy

export interface ModuleAccuracyRow {
  module: Module;
  answered: number;
  firstTry: number;
  accuracy: number;
  openMistakes: number;
}

export function moduleAccuracyRows(s: ProgressData): ModuleAccuracyRow[] {
  const acc = new Map<string, { answered: number; firstTry: number }>();
  for (const [id, r] of Object.entries(s.blocks)) {
    const loc = findBlock(id);
    if (!loc) continue;
    const a = acc.get(loc.module.id) ?? { answered: 0, firstTry: 0 };
    a.answered++;
    if (r.firstTry) a.firstTry++;
    acc.set(loc.module.id, a);
  }
  const open = new Map<string, number>();
  for (const m of Object.values(s.mistakes)) if (!m.resolved && findBlock(m.blockId)) open.set(m.moduleId, (open.get(m.moduleId) ?? 0) + 1);
  return modules
    .filter((m) => acc.get(m.id)?.answered)
    .map((m) => {
      const a = acc.get(m.id)!;
      return { module: m, answered: a.answered, firstTry: a.firstTry, accuracy: a.firstTry / a.answered, openMistakes: open.get(m.id) ?? 0 };
    });
}

// ------------------------------------------------------------------ review forecast

export interface ForecastDay {
  key: string;
  offset: number; // 0 = today (incl. overdue)
  label: string; // "Bugün", "Yarın", "14 Eki"
  weekday: string;
  flashcards: number;
  checks: number;
  total: number;
}

/**
 * Reviews due per day for the next `days` days. Today's bucket equals the real due list (incl. the
 * daily new-card limit); new cards beyond the limit spill into the following days.
 */
export function reviewForecast(s: ProgressData, days = 30, now: Date = new Date()): ForecastDay[] {
  const todayKey = dayKey(now);
  const out: ForecastDay[] = Array.from({ length: days }, (_, offset) => {
    const key = addDays(todayKey, offset);
    return {
      key,
      offset,
      label: offset === 0 ? 'Bugün' : offset === 1 ? 'Yarın' : shortDate(key),
      weekday: WEEKDAYS_SHORT[weekdayIndex(parseDayKey(key))],
      flashcards: 0,
      checks: 0,
      total: 0,
    };
  });
  const add = (offset: number, e: SrsEntry) => {
    const d = out[offset];
    if (!d) return;
    if (e.kind === 'flashcard') d.flashcards++;
    else d.checks++;
    d.total++;
  };
  const dueNow = dueReviews(s, now);
  const dueIds = new Set(dueNow.map((e) => e.id));
  dueNow.forEach((e) => add(0, e));
  const backlog: SrsEntry[] = [];
  for (const e of Object.values(s.srs)) {
    if (e.suspended || dueIds.has(e.id) || !sourceExists(e)) continue;
    if (e.card.state === 0) {
      backlog.push(e);
      continue;
    }
    const offset = Math.max(0, calendarDayDiff(now, new Date(e.card.due)));
    if (offset < days) add(offset, e);
  }
  backlog.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
  const perDay = Math.max(1, s.settings.newCardsPerDay);
  for (let offset = 1, i = 0; offset < days && i < backlog.length; offset++) {
    for (let n = 0; n < perDay && i < backlog.length; n++, i++) add(offset, backlog[i]);
  }
  return out;
}

// ------------------------------------------------------------------ confidence calibration

export const CONFIDENCE_LABELS: Record<1 | 2 | 3, string> = { 1: 'Tahmin ettim', 2: 'Biraz emindim', 3: 'Çok emindim' };

export interface CalibrationRow {
  level: 1 | 2 | 3;
  label: string;
  n: number;
  correct: number;
  rate: number | null;
}

export interface CalibrationData {
  rows: CalibrationRow[];
  total: number;
  confidentErrors: string[]; // block ids answered wrong while "çok emin"
  luckyGuesses: string[]; // block ids answered right while guessing
}

/** For each confidence level: share of answers that were correct (the latest answer and its rating). */
export function calibration(s: ProgressData): CalibrationData {
  const rows: CalibrationRow[] = ([1, 2, 3] as const).map((level) => ({ level, label: CONFIDENCE_LABELS[level], n: 0, correct: 0, rate: null }));
  const confidentErrors: string[] = [];
  const luckyGuesses: string[] = [];
  for (const [id, r] of Object.entries(s.blocks)) {
    if (!r.confidence) continue;
    const row = rows[r.confidence - 1];
    row.n++;
    if (r.correct) row.correct++;
    if (r.confidence === 3 && !r.correct) confidentErrors.push(id);
    if (r.confidence === 1 && r.correct) luckyGuesses.push(id);
  }
  for (const row of rows) row.rate = row.n ? row.correct / row.n : null;
  return { rows, total: rows.reduce((n, r) => n + r.n, 0), confidentErrors, luckyGuesses };
}

// ------------------------------------------------------------------ memory strength

export interface MemorySnapshot {
  reviewed: number; // cards reviewed at least once (not suspended)
  fresh: number; // never reviewed yet
  avgRetrievability: number | null;
  strong: number; // R ≥ 90 %
  medium: number; // 70–90 %
  weak: number; // < 70 %
  longTerm: number;
  medianStability: number | null; // days
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function memorySnapshot(s: ProgressData, now: Date = new Date()): MemorySnapshot {
  let sum = 0;
  const snap: MemorySnapshot = { reviewed: 0, fresh: 0, avgRetrievability: null, strong: 0, medium: 0, weak: 0, longTerm: 0, medianStability: null };
  const stabilities: number[] = [];
  for (const e of Object.values(s.srs)) {
    if (e.suspended || !sourceExists(e)) continue;
    if (e.card.state === 0) {
      snap.fresh++;
      continue;
    }
    const R = retrievability(e.card, now);
    snap.reviewed++;
    sum += R;
    stabilities.push(e.card.stability);
    if (R >= 0.9) snap.strong++;
    else if (R >= 0.7) snap.medium++;
    else snap.weak++;
    if (isLongTerm(e.card, now)) snap.longTerm++;
  }
  snap.avgRetrievability = snap.reviewed ? sum / snap.reviewed : null;
  snap.medianStability = median(stabilities);
  return snap;
}

/** Average recall probability of the reviewed cards if the learner stopped reviewing for `days`. */
export function projectedRetention(s: ProgressData, days: number, now: Date = new Date()): number | null {
  const later = new Date(now.getTime() + days * DAY_MS);
  let sum = 0;
  let n = 0;
  for (const e of Object.values(s.srs)) {
    if (e.suspended || e.card.state === 0 || !sourceExists(e)) continue;
    sum += retrievability(e.card, later);
    n++;
  }
  return n ? sum / n : null;
}

export interface MeasuredBucket {
  label: string;
  day: number; // x position on the curve
  n: number;
  recalled: number;
  rate: number;
}

const BUCKETS: { label: string; from: number; to: number; day: number }[] = [
  { label: '1 gün', from: 0.5, to: 1.5, day: 1 },
  { label: '2–3 gün', from: 1.5, to: 3.5, day: 2.5 },
  { label: '4–7 gün', from: 3.5, to: 7.5, day: 5.5 },
  { label: '8–14 gün', from: 7.5, to: 14.5, day: 11 },
  { label: '15–30 gün', from: 14.5, to: 30.5, day: 22 },
  { label: '30+ gün', from: 30.5, to: Infinity, day: 30 },
];

/**
 * Real recall rates from the review history: for every review that followed an earlier one by at
 * least half a day, did the learner remember (grade ≥ 2)? Grouped by the gap since the previous review.
 */
export function measuredRetention(s: ProgressData, minN = 3): MeasuredBucket[] {
  const byCard = new Map<string, { t: number; grade: number }[]>();
  for (const r of s.reviewLog) {
    const t = Date.parse(r.at);
    if (Number.isNaN(t)) continue;
    const list = byCard.get(r.id) ?? [];
    list.push({ t, grade: r.grade });
    byCard.set(r.id, list);
  }
  const counts = BUCKETS.map(() => ({ n: 0, recalled: 0 }));
  for (const list of byCard.values()) {
    list.sort((a, b) => a.t - b.t);
    for (let i = 1; i < list.length; i++) {
      const gap = (list[i].t - list[i - 1].t) / DAY_MS;
      const b = BUCKETS.findIndex((x) => gap >= x.from && gap < x.to);
      if (b < 0) continue;
      counts[b].n++;
      if (list[i].grade >= 2) counts[b].recalled++;
    }
  }
  return BUCKETS.map((b, i) => ({ label: b.label, day: b.day, n: counts[i].n, recalled: counts[i].recalled, rate: counts[i].n ? counts[i].recalled / counts[i].n : 0 })).filter(
    (b) => b.n >= minN,
  );
}

export interface RetentionPoint {
  day: number;
  typical: number; // learner's median card (or the illustrative curve)
  fresh: number; // a memory reviewed once
  measured?: number;
  measuredN?: number;
  measuredLabel?: string;
}

export const FRESH_STABILITY = 1;
export const ILLUSTRATIVE_STABILITY = 21;

/** Forgetting curves for the retention chart, with the learner's measured recall rates merged in. */
export function retentionCurve(s: ProgressData, maxDays = 30, now: Date = new Date()): { points: RetentionPoint[]; stability: number; illustrative: boolean; measured: MeasuredBucket[] } {
  const snap = memorySnapshot(s, now);
  const illustrative = snap.medianStability === null;
  const stability = snap.medianStability ?? ILLUSTRATIVE_STABILITY;
  const measured = measuredRetention(s);
  const points: RetentionPoint[] = [];
  for (let day = 0; day <= maxDays; day++) {
    points.push({ day, typical: forgettingCurve(day, stability), fresh: forgettingCurve(day, FRESH_STABILITY) });
  }
  for (const m of measured) {
    const p = points.find((x) => x.day === Math.round(m.day));
    if (p) {
      p.measured = m.rate;
      p.measuredN = m.n;
      p.measuredLabel = m.label;
    }
  }
  return { points, stability, illustrative, measured };
}

// ------------------------------------------------------------------ time of day

export type DaypartId = 'sabah' | 'ogle' | 'aksam' | 'gece';

export interface DaypartRow {
  id: DaypartId;
  label: string;
  range: string;
  n: number;
  correct: number;
  rate: number | null;
}

const DAYPARTS: { id: DaypartId; label: string; range: string; test: (h: number) => boolean }[] = [
  { id: 'sabah', label: 'Sabah', range: '05:00–12:00', test: (h) => h >= 5 && h < 12 },
  { id: 'ogle', label: 'Öğleden sonra', range: '12:00–17:00', test: (h) => h >= 12 && h < 17 },
  { id: 'aksam', label: 'Akşam', range: '17:00–22:00', test: (h) => h >= 17 && h < 22 },
  { id: 'gece', label: 'Gece', range: '22:00–05:00', test: (h) => h >= 22 || h < 5 },
];

/** Accuracy by time of day, from reviews (grade ≥ 2 = remembered) and checks (latest answer). */
export function daypartPerformance(s: ProgressData): DaypartRow[] {
  const rows: DaypartRow[] = DAYPARTS.map((d) => ({ id: d.id, label: d.label, range: d.range, n: 0, correct: 0, rate: null }));
  const add = (iso: string, ok: boolean) => {
    const t = new Date(iso);
    if (Number.isNaN(t.getTime())) return;
    const i = DAYPARTS.findIndex((d) => d.test(t.getHours()));
    rows[i].n++;
    if (ok) rows[i].correct++;
  };
  for (const r of s.reviewLog) add(r.at, r.grade >= 2);
  for (const r of Object.values(s.blocks)) add(r.at, r.correct);
  for (const r of rows) r.rate = r.n ? r.correct / r.n : null;
  return rows;
}

// ------------------------------------------------------------------ insights

export type InsightKind = 'strength' | 'focus' | 'hours' | 'trend' | 'memory' | 'calibration' | 'streak' | 'start';

export interface Insight {
  kind: InsightKind;
  tone: 'good' | 'focus' | 'neutral';
  title: string;
  text: string;
  link?: { to: string; label: string };
}

function focusInsight(s: ProgressData, rows: ModuleAccuracyRow[], strongestId?: string): Insight | null {
  // 1) the lesson with the most open mistakes
  const perLesson = new Map<string, number>();
  for (const m of Object.values(s.mistakes)) if (!m.resolved && findBlock(m.blockId)) perLesson.set(m.lessonId, (perLesson.get(m.lessonId) ?? 0) + 1);
  const worst = [...perLesson.entries()].sort((a, b) => b[1] - a[1])[0];
  if (worst) {
    const lesson = getLesson(worst[0]);
    const module = lesson ? getModule(lesson.moduleId) : undefined;
    if (lesson)
      return {
        kind: 'focus',
        tone: 'focus',
        title: 'Tekrar etmen gereken konu',
        text: `${module ? `${module.icon} ` : ''}${lesson.title}: ${worst[1]} açık hatan var. Hata defterinden yeniden dene; doğru cevapladığında defterden düşer.`,
        link: { to: '/antrenman?sekme=hata', label: 'Hata defterini aç' },
      };
  }
  // 2) the module with the lowest first-try accuracy
  const weak = rows.filter((r) => r.answered >= 3 && r.accuracy < 0.8 && r.module.id !== strongestId).sort((a, b) => a.accuracy - b.accuracy)[0];
  if (weak)
    return {
      kind: 'focus',
      tone: 'focus',
      title: 'Tekrar etmen gereken konu',
      text: `${weak.module.icon} ${weak.module.title}: ilk deneme doğruluğun ${formatPercent(weak.accuracy)}. Bu modülle kısa bir karma antrenman iyi gelir.`,
      link: { to: `/antrenman?modul=${weak.module.id}`, label: 'Bu modülle çalış' },
    };
  return null;
}

export function buildInsights(s: ProgressData, now: Date = new Date()): Insight[] {
  const out: Insight[] = [];
  const rows = moduleAccuracyRows(s);
  const qualified = rows.filter((r) => r.answered >= 5);
  const pool = qualified.length ? qualified : rows.filter((r) => r.answered >= 2);
  const strongest = [...pool].sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered)[0];
  if (strongest)
    out.push({
      kind: 'strength',
      tone: 'good',
      title: 'En güçlü olduğun modül',
      text: `${strongest.module.icon} ${strongest.module.title}: ilk denemede doğruluğun ${formatPercent(strongest.accuracy)}. Bu modülün sorularını sağlam biliyorsun.`,
    });

  const focus = focusInsight(s, rows, strongest?.module.id);
  if (focus) out.push(focus);

  const parts = daypartPerformance(s).filter((p) => p.n >= 8);
  if (parts.length >= 2) {
    const best = [...parts].sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0))[0];
    out.push({
      kind: 'hours',
      tone: 'neutral',
      title: 'En verimli saatlerin',
      text: `${best.label} (${best.range}) doğruluğun ${formatPercent(best.rate)}. Yeni ve zor konuları bu saatlere koymayı dene.`,
    });
  } else if (parts.length === 1) {
    out.push({
      kind: 'hours',
      tone: 'neutral',
      title: 'En verimli saatlerin',
      text: `Çoğunlukla ${parts[0].label.toLocaleLowerCase('tr-TR')} saatlerinde (${parts[0].range}) çalışıyorsun ve doğruluğun ${formatPercent(parts[0].rate)}. Farklı saatleri denersen hangisinin sana uyduğunu görebilirsin.`,
    });
  }

  const cal = calibration(s);
  if (cal.confidentErrors.length >= 2)
    out.push({
      kind: 'calibration',
      tone: 'focus',
      title: 'Emin olduğun hatalar',
      text: `"Çok emindim" dediğin ${cal.confidentErrors.length} soruda yanıldın. Bunlar en kalıcı öğrenme fırsatları: düzeltilen güçlü yanlışlar kolay unutulmaz.`,
      link: { to: '/antrenman?sekme=hata', label: 'Bu hataları gözden geçir' },
    });

  const due = dueReviews(s, now).length;
  const snap = memorySnapshot(s, now);
  if (due > 0)
    out.push({
      kind: 'memory',
      tone: 'focus',
      title: 'Hafızanı tazele',
      text: `${due} kart tekrar bekliyor. Kısa bir tekrar oturumu unutma eğrisini yeniden yukarı çeker.`,
      link: { to: '/tekrar', label: 'Tekrara başla' },
    });
  else if (snap.reviewed >= 5)
    out.push({
      kind: 'memory',
      tone: 'good',
      title: 'Hafızan sağlam',
      text: `Tekrar ettiğin kartları şu an ortalama ${formatPercent(snap.avgRetrievability)} olasılıkla hatırlıyorsun; ${snap.longTerm} kart uzun süreli hafızada.`,
    });

  const trend = xpTrend(s, 7, now);
  if (trend.change !== null && trend.current > 0)
    out.push({
      kind: 'trend',
      tone: trend.change >= 0 ? 'good' : 'neutral',
      title: 'Bu hafta',
      text:
        trend.change >= 0
          ? `Son 7 günde ${formatNumber(trend.current)} XP kazandın, önceki haftadan ${formatPercent(trend.change)} fazla.`
          : `Son 7 günde ${formatNumber(trend.current)} XP kazandın, önceki haftanın biraz gerisinde. Kısa ama düzenli oturumlar yeterli.`,
    });

  if (s.streak.current >= 3)
    out.push({
      kind: 'streak',
      tone: 'good',
      title: 'Serin sürüyor',
      text: `${s.streak.current} gündür aralıksız çalışıyorsun (en iyi serin ${s.streak.best} gün). Her gün birkaç dakika bile seriyi korur.`,
    });

  if (!out.length)
    out.push({
      kind: 'start',
      tone: 'neutral',
      title: 'Yolculuğun yeni başlıyor',
      text: 'İlk derslerini tamamlayıp birkaç tekrar yaptıkça burada sana özel öneriler göreceksin.',
      link: { to: '/', label: 'Derse başla' },
    });
  return out.slice(0, 4);
}

// ------------------------------------------------------------------ page-level helpers

/** True for a learner who has not produced any data yet (shows the welcome state instead of charts). */
export function isNewLearner(s: ProgressData): boolean {
  return (
    s.xp <= 0 &&
    !Object.keys(s.blocks).length &&
    !Object.keys(s.srs).length &&
    !s.reviewLog.length &&
    !Object.values(s.lessons).some((l) => l.status === 'completed')
  );
}

export interface PeriodTotals {
  xp: number;
  seconds: number;
  activeDays: number;
  goalDays: number;
  lessons: number;
  reviews: number;
  checks: number;
}

/** Sums of the daily activity over the last `days` days (today included). */
export function periodTotals(s: ProgressData, days = 7, today: Date = new Date()): PeriodTotals {
  const todayKey = dayKey(today);
  const out: PeriodTotals = { xp: 0, seconds: 0, activeDays: 0, goalDays: 0, lessons: 0, reviews: 0, checks: 0 };
  for (let i = 0; i < days; i++) {
    const a = s.activity[addDays(todayKey, -i)];
    if (!a) continue;
    out.xp += a.xp;
    out.seconds += a.seconds;
    out.lessons += a.lessons;
    out.reviews += a.reviews;
    out.checks += a.checks;
    if (a.xp > 0 || a.seconds > 0) out.activeDays++;
    if (a.xp >= s.settings.dailyGoalXp) out.goalDays++;
  }
  return out;
}

export interface XpSeriesSummary {
  total: number;
  activeDays: number;
  goalDays: number;
  perActiveDay: number | null;
  best?: XpDay;
}

export function summarizeXp(days: readonly XpDay[]): XpSeriesSummary {
  let total = 0;
  let activeDays = 0;
  let goalDays = 0;
  let best: XpDay | undefined;
  for (const d of days) {
    total += d.xp;
    if (d.xp > 0) activeDays++;
    if (d.goalMet && d.xp > 0) goalDays++;
    if (d.xp > 0 && (!best || d.xp > best.xp)) best = d;
  }
  return { total, activeDays, goalDays, perActiveDay: activeDays ? total / activeDays : null, best };
}

export interface ForecastSummary {
  today: number;
  week: number; // next 7 days incl. today
  total: number;
  peak?: ForecastDay;
}

export function summarizeForecast(days: readonly ForecastDay[]): ForecastSummary {
  let week = 0;
  let total = 0;
  let peak: ForecastDay | undefined;
  for (const d of days) {
    total += d.total;
    if (d.offset < 7) week += d.total;
    if (d.total > 0 && (!peak || d.total > peak.total)) peak = d;
  }
  return { today: days[0]?.total ?? 0, week, total, peak };
}

/**
 * What a well-calibrated learner would score at each confidence level — the "ideal" markers on the
 * calibration chart ("tahmin" is close to chance, "çok emin" should almost always be right).
 */
export const CALIBRATION_TARGET: Record<1 | 2 | 3, number> = { 1: 0.45, 2: 0.75, 3: 0.95 };

export type CalibrationVerdictId = 'none' | 'early' | 'calibrated' | 'overconfident' | 'underconfident' | 'mixed';

export interface CalibrationVerdict {
  id: CalibrationVerdictId;
  tone: 'good' | 'focus' | 'neutral';
  title: string;
  text: string;
}

/** A friendly reading of the calibration rows. Needs a few rated answers before it says anything firm. */
export function calibrationVerdict(c: CalibrationData, minPerLevel = 3): CalibrationVerdict {
  if (!c.total)
    return {
      id: 'none',
      tone: 'neutral',
      title: 'Henüz güven puanı yok',
      text: 'Derslerdeki sorulardan sonra “Ne kadar emindin?” sorusunu cevapladıkça burada güveninle doğruluğunu karşılaştıracağız.',
    };
  const [guess, some, sure] = c.rows;
  const ok = (r: CalibrationRow) => r.n >= minPerLevel && r.rate !== null;
  if (!ok(sure) && !ok(guess) && !ok(some))
    return {
      id: 'early',
      tone: 'neutral',
      title: 'Biraz daha veri gerekiyor',
      text: `Şimdiye kadar ${c.total} cevaba güven puanı verdin. Her seviyede birkaç cevap biriktiğinde güveninin ne kadar isabetli olduğunu göreceksin.`,
    };
  if (ok(sure) && sure.rate! < 0.75)
    return {
      id: 'overconfident',
      tone: 'focus',
      title: 'Bazen gereğinden fazla eminsin',
      text: `“Çok emindim” dediğin cevapların ${formatPercent(sure.rate)} kadarı doğru. Cevaplamadan önce kısa bir an “Neden böyle?” diye kendine sor; açıklayamıyorsan güvenini bir basamak düşür.`,
    };
  if (ok(guess) && guess.rate! >= 0.75)
    return {
      id: 'underconfident',
      tone: 'good',
      title: 'Bildiğinden daha az eminsin',
      text: `“Tahmin ettim” dediğin cevapların bile ${formatPercent(guess.rate)} kadarı doğru. Sezgin sandığından sağlam; kendine biraz daha güvenebilirsin.`,
    };
  const rated = c.rows.filter(ok);
  const rising = rated.every((r, i) => i === 0 || (r.rate ?? 0) >= (rated[i - 1].rate ?? 0) - 0.02);
  if (rated.length >= 2 && rising)
    return {
      id: 'calibrated',
      tone: 'good',
      title: 'Güvenin isabetli',
      text: 'Emin olduğunda gerçekten çoğunlukla doğru, tahmin ettiğinde daha az doğru cevaplıyorsun. Ne bildiğini ve ne bilmediğini iyi ayırt ediyorsun.',
    };
  return {
    id: 'mixed',
    tone: 'neutral',
    title: 'Güvenin henüz net bir desen göstermiyor',
    text: 'Bazı seviyelerde güvenin doğruluğunla örtüşmüyor. Cevaplamadan önce sonucu tahmin etmeye devam et; zamanla daha isabetli olacak.',
  };
}
