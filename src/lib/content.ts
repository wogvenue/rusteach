// Content access helpers. The whole curriculum is one JSON bundle generated at build time.
import raw from '../generated/content.json';
import type {
  Block, ContentBundle, ExerciseBlock, Flashcard, Lesson, Module, ScoredBlock, Tier,
} from '../types/content';
import { CHECK_TYPES } from '../types/content';

export const content = raw as unknown as ContentBundle;

export const tiers: Tier[] = content.tiers;
export const modules: Module[] = [...content.modules].sort((a, b) => a.order - b.order);
export const lessons: Record<string, Lesson> = content.lessons;

const moduleById = new Map(modules.map((m) => [m.id, m]));
const tierById = new Map(tiers.map((t) => [t.id, t]));

export interface BlockLocation {
  block: Block;
  lesson: Lesson;
  module: Module;
  stepIndex: number;
}

const blockIndex = new Map<string, BlockLocation>();
const flashcardIndex = new Map<string, { card: Flashcard; lesson: Lesson; module: Module }>();

for (const lesson of Object.values(lessons)) {
  const module = moduleById.get(lesson.moduleId);
  if (!module) continue;
  lesson.steps.forEach((step, stepIndex) => {
    for (const block of step.blocks) {
      if ('id' in block && block.id) blockIndex.set(block.id, { block, lesson, module, stepIndex });
      if (block.type === 'flashcards')
        for (const card of block.cards) flashcardIndex.set(card.id, { card, lesson, module });
    }
  });
}

export function getModule(id: string): Module | undefined {
  return moduleById.get(id);
}
export function getTier(id: string): Tier | undefined {
  return tierById.get(id);
}
export function getLesson(id: string): Lesson | undefined {
  return lessons[id];
}
export function findBlock(id: string): BlockLocation | undefined {
  return blockIndex.get(id);
}
export function findFlashcard(id: string) {
  return flashcardIndex.get(id);
}

/** Regular + project lessons of a module (no boss), in order. */
export function moduleLessons(m: Module): Lesson[] {
  return m.lessonIds.map((id) => lessons[id]).filter(Boolean);
}

export function modulesOfTier(tierId: string): Module[] {
  return modules.filter((m) => m.tier === tierId);
}

export function allBlocks(lesson: Lesson): Block[] {
  return lesson.steps.flatMap((s) => s.blocks);
}

export function isCheck(b: Block): b is Extract<Block, { type: (typeof CHECK_TYPES)[number] }> {
  return (CHECK_TYPES as readonly string[]).includes(b.type);
}

export function isScored(b: Block): b is ScoredBlock {
  return isCheck(b) || b.type === 'exercise';
}

export function scoredBlocks(lesson: Lesson): ScoredBlock[] {
  return allBlocks(lesson).filter(isScored);
}

export function lessonFlashcards(lesson: Lesson): Flashcard[] {
  return allBlocks(lesson).flatMap((b) => (b.type === 'flashcards' ? b.cards : []));
}

export function allExercises(): { block: ExerciseBlock; lesson: Lesson; module: Module }[] {
  const out: { block: ExerciseBlock; lesson: Lesson; module: Module }[] = [];
  for (const [, loc] of blockIndex) if (loc.block.type === 'exercise') out.push({ block: loc.block, lesson: loc.lesson, module: loc.module });
  return out;
}

export function allChecks(): BlockLocation[] {
  return [...blockIndex.values()].filter((l) => isCheck(l.block));
}

export function nextModule(m: Module): Module | undefined {
  return modules[modules.indexOf(m) + 1];
}
export function prevModule(m: Module): Module | undefined {
  const i = modules.indexOf(m);
  return i > 0 ? modules[i - 1] : undefined;
}

export const totals = {
  modules: modules.length,
  lessons: Object.values(lessons).filter((l) => l.type !== 'boss').length,
  exercises: allExercises().length,
  flashcards: flashcardIndex.size,
};
