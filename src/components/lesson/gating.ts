// Step gating and scoring helpers for the lesson / boss player.
import type { Lesson, ScoredBlock, Step } from '../../types/content';
import { isScored } from '../../lib/content';
import type { ProgressData } from '../../store/progress';
import type { BlockOutcome } from '../blocks/types';

export function stepScored(step: Step): ScoredBlock[] {
  return step.blocks.filter(isScored);
}

export function lessonScored(lesson: Lesson): ScoredBlock[] {
  return lesson.steps.flatMap(stepScored);
}

/** Scored and reflect blocks the learner already resolved on an earlier visit (restored in lesson mode). */
export function priorResolved(s: ProgressData, lesson: Lesson): Set<string> {
  const out = new Set<string>();
  for (const b of lessonScored(lesson)) {
    if (b.type === 'exercise') {
      const e = s.exercises[b.id];
      if (e?.solved || e?.usedSolution) out.add(b.id);
    } else if (s.blocks[b.id]) out.add(b.id);
  }
  for (const step of lesson.steps)
    for (const b of step.blocks) if (b.type === 'reflect' && s.reflections[b.id]) out.add(b.id);
  return out;
}

/** First-try result of a scored block: this session's outcome first, otherwise the stored one. */
export function firstTry(
  b: ScoredBlock,
  s: ProgressData,
  outcomes: Record<string, BlockOutcome>,
  useStored: boolean,
): boolean | null {
  const o = outcomes[b.id];
  if (o) return o.correct;
  if (!useStored) return null;
  if (b.type === 'exercise') {
    const e = s.exercises[b.id];
    return e && (e.solved || e.usedSolution) ? e.solved && !e.usedSolution : null;
  }
  const r = s.blocks[b.id];
  return r ? r.firstTry : null;
}

export interface Accuracy {
  correct: number;
  answered: number;
  total: number;
  ratio: number | null;
}

export function lessonAccuracy(
  lesson: Lesson,
  s: ProgressData,
  outcomes: Record<string, BlockOutcome>,
  useStored: boolean,
): Accuracy {
  const scored = lessonScored(lesson);
  let correct = 0;
  let answered = 0;
  for (const b of scored) {
    const r = firstTry(b, s, outcomes, useStored);
    if (r === null) continue;
    answered++;
    if (r) correct++;
  }
  return { correct, answered, total: scored.length, ratio: answered ? correct / answered : null };
}

/** Short, plain-text label of a scored block (for result lists). */
export function blockSummary(b: ScoredBlock): string {
  const html =
    b.type === 'quiz' || b.type === 'predict' || b.type === 'compiles'
      ? b.question
      : b.type === 'exercise'
        ? b.title
        : b.prompt;
  const text = html
    // block-level tags separate words; inline ones (code, strong, em) must not add spaces
    .replace(/<\/?(p|div|br|li|ul|ol|h\d|pre|blockquote)\b[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > 110 ? `${text.slice(0, 107).trimEnd()}…` : text;
}

export const BLOCK_LABELS: Record<ScoredBlock['type'], string> = {
  quiz: 'Soru',
  predict: 'Tahmin et',
  compiles: 'Derlenir mi?',
  fill: 'Boşluk doldur',
  parsons: 'Sırala',
  exercise: 'Alıştırma',
};
