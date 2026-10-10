// Contract for lesson block components (owned by the lesson-player implementation, reused by
// the review / practice pages).
//
// Responsibilities of a block component:
//  * Render the block and handle the learner's interaction.
//  * Persist its own result in the progress store according to `mode`:
//      check blocks  -> useProgress.getState().recordBlock(block.id, lessonId, { correct, confidence, answer, context: mode })
//      exercise      -> saveExerciseCode / useHint / recordExercise(...)
//      reflect       -> setReflection(...)
//  * Call `onComplete` once the learner has committed an answer / solved (or revealed the solution) /
//    finished reflecting. Parents use it for step gating, boss scoring and SRS grading.
//  * In 'lesson' mode, restore the previously answered state from the store (so revisiting a lesson
//    shows answers). In 'review' | 'practice' | 'boss' mode (or when `fresh` is true) start clean.
//  * In 'boss' mode show correctness immediately but keep explanations short; never reveal the
//    solution of an exercise in boss mode.
import type { Block } from '../../types/content';
import type { Confidence } from '../../store/progress';

export type BlockMode = 'lesson' | 'review' | 'boss' | 'practice';

export interface BlockOutcome {
  correct: boolean; // for exercises: solved without revealing the solution
  confidence?: Confidence;
  answer?: unknown;
  revealedSolution?: boolean;
}

export interface BlockProps<B extends Block = Block> {
  block: B;
  lessonId: string;
  mode: BlockMode;
  onComplete?: (outcome: BlockOutcome) => void;
  fresh?: boolean;
}
