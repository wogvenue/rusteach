// Spaced repetition scheduling (FSRS via ts-fsrs). Cards are stored serialized (ISO dates) in the
// progress store. Grades: 1 = Tekrar (again), 2 = Zor (hard), 3 = İyi (good), 4 = Kolay (easy).
// Must not import the progress store (the store imports this module).
import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade as FsrsGrade } from 'ts-fsrs';

export type Grade = 1 | 2 | 3 | 4;

export interface SerializedCard {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number; // 0 New, 1 Learning, 2 Review, 3 Relearning
  last_review?: string;
}

/** Target probability of recall when a card comes due. */
export const REQUEST_RETENTION = 0.9;

const scheduler = fsrs(
  generatorParameters({ request_retention: REQUEST_RETENTION, maximum_interval: 365, enable_fuzz: true, enable_short_term: true }),
);

const DAY_MS = 86_400_000;

function toCard(s: SerializedCard): Card {
  return {
    ...s,
    due: new Date(s.due),
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as Card;
}

function fromCard(c: Card): SerializedCard {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: (c as Card & { learning_steps?: number }).learning_steps ?? 0,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : undefined,
  };
}

export function newCard(now = new Date()): SerializedCard {
  return fromCard(createEmptyCard(now));
}

export function reviewCard(card: SerializedCard, grade: Grade, now = new Date()): SerializedCard {
  const res = scheduler.next(toCard(card), now, grade as unknown as FsrsGrade);
  return fromCard(res.card);
}

export function isDue(card: SerializedCard, now = new Date()): boolean {
  return new Date(card.due).getTime() <= now.getTime();
}

export function isNew(card: SerializedCard): boolean {
  return card.state === State.New;
}

/** Human readable interval for each grade, e.g. { 1: "1 dk", 3: "2 gün" } - for grade buttons. */
export function previewIntervals(card: SerializedCard, now = new Date()): Record<Grade, string> {
  const rec = scheduler.repeat(toCard(card), now);
  const out = {} as Record<Grade, string>;
  for (const g of [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy] as const) {
    const due = rec[g].card.due.getTime();
    out[g as Grade] = formatInterval(due - now.getTime());
  }
  return out;
}

export function formatInterval(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 60) return `${min} dk`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} sa`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} gün`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} ay`;
  return `${(d / 365).toFixed(1)} yıl`;
}

/** Probability the learner still remembers the card right now (0..1). */
export function retrievability(card: SerializedCard, now = new Date()): number {
  // a card without a review date (e.g. a hand-edited import) would make ts-fsrs throw and take the page down
  if (card.state === State.New || !card.last_review) return 0;
  return scheduler.get_retrievability(toCard(card), now, false) as number;
}

// ------------------------------------------------------------------ additions (learning engine)

export type CardStage = 'new' | 'learning' | 'review' | 'relearning';

export function cardStage(card: SerializedCard): CardStage {
  if (card.state === State.New) return 'new';
  if (card.state === State.Learning) return 'learning';
  if (card.state === State.Relearning) return 'relearning';
  return 'review';
}

export const STAGE_LABELS: Record<CardStage, string> = {
  new: 'Yeni',
  learning: 'Öğreniliyor',
  review: 'Tekrar',
  relearning: 'Yeniden öğreniliyor',
};

/**
 * FSRS forgetting curve: probability of recall `elapsedDays` after the last review for a memory
 * whose stability is `stabilityDays` (by definition R = 90 % when elapsed = stability).
 */
export function forgettingCurve(elapsedDays: number, stabilityDays: number): number {
  if (!(stabilityDays > 0)) return 0;
  return scheduler.forgetting_curve(Math.max(0, elapsedDays), stabilityDays);
}

/** A card counts as "long-term memory" when it is both strong now and stable for weeks. */
export const LONG_TERM = { retrievability: 0.9, stabilityDays: 21 } as const;

export function isLongTerm(card: SerializedCard, now = new Date()): boolean {
  return (
    card.state !== State.New &&
    card.stability > LONG_TERM.stabilityDays &&
    retrievability(card, now) > LONG_TERM.retrievability
  );
}

/** Days since the last review (fractional), or null for a card never reviewed. */
export function daysSinceReview(card: SerializedCard, now = new Date()): number | null {
  if (!card.last_review) return null;
  return Math.max(0, (now.getTime() - new Date(card.last_review).getTime()) / DAY_MS);
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Whole calendar days between two dates in local time (b - a). */
export function calendarDayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);
}

/** Relative, learner-facing due label: "Şimdi", "15 dk sonra", "Yarın", "3 gün sonra", "2 gün gecikti". */
export function formatDue(card: SerializedCard, now = new Date()): string {
  const due = new Date(card.due);
  const diffMs = due.getTime() - now.getTime();
  const days = calendarDayDiff(now, due);
  if (diffMs <= 0) {
    return days <= -1 ? `${-days} gün gecikti` : 'Şimdi';
  }
  if (days === 0) {
    const min = Math.max(1, Math.round(diffMs / 60000));
    return min < 60 ? `${min} dk sonra` : `${Math.round(min / 60)} sa sonra`;
  }
  if (days === 1) return 'Yarın';
  if (days < 45) return `${days} gün sonra`;
  if (days < 365) return `${Math.round(days / 30)} ay sonra`;
  return `${(days / 365).toFixed(1)} yıl sonra`;
}
