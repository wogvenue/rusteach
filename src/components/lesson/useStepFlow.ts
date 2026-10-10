// Step-by-step reveal + gating state shared by the lesson and boss players.
// A step is "ready" when every check, exercise and reflect block in it is resolved (exercises may
// be deferred with "Şimdilik geç"). Block outcomes of this visit are kept for scoring.
import { useCallback, useMemo, useState } from 'react';
import type { Block, Lesson, Step } from '../../types/content';
import { isScored } from '../../lib/content';
import type { BlockOutcome } from '../blocks/types';
import type { Segment } from './LessonTopBar';

/** Blocks that gate the "Devam" button of their step. */
export function gatingBlocks(step: Step): Extract<Block, { id: string }>[] {
  return step.blocks.filter((b): b is Extract<Block, { id: string }> => isScored(b) || b.type === 'reflect');
}

export interface PendingCounts {
  checks: number;
  exercises: number;
  reflects: number;
}

interface Options {
  lesson: Lesson;
  /** Index of the furthest revealed step on entry. */
  initialRevealed: number;
  /** Block ids already resolved (restored from an earlier visit). */
  initialResolved?: Iterable<string>;
}

export function useStepFlow({ lesson, initialRevealed, initialResolved }: Options) {
  const last = Math.max(0, lesson.steps.length - 1);
  const [revealed, setRevealed] = useState(() => Math.min(Math.max(0, initialRevealed), last));
  const [resolved, setResolved] = useState<Set<string>>(() => new Set(initialResolved ?? []));
  const [deferred, setDeferred] = useState<Set<string>>(() => new Set());
  const [outcomes, setOutcomes] = useState<Record<string, BlockOutcome>>({});

  const onBlockComplete = useCallback((blockId: string, outcome: BlockOutcome) => {
    setOutcomes((o) => (o[blockId] ? o : { ...o, [blockId]: outcome }));
    setResolved((s) => (s.has(blockId) ? s : new Set(s).add(blockId)));
    setDeferred((s) => {
      if (!s.has(blockId)) return s;
      const n = new Set(s);
      n.delete(blockId);
      return n;
    });
  }, []);

  const pendingIn = useCallback(
    (step: Step): PendingCounts => {
      const p: PendingCounts = { checks: 0, exercises: 0, reflects: 0 };
      for (const b of gatingBlocks(step)) {
        if (resolved.has(b.id) || deferred.has(b.id)) continue;
        if (b.type === 'exercise') p.exercises++;
        else if (b.type === 'reflect') p.reflects++;
        else p.checks++;
      }
      return p;
    },
    [resolved, deferred],
  );

  const current = lesson.steps[revealed];
  const pending = useMemo<PendingCounts>(
    () => (current ? pendingIn(current) : { checks: 0, exercises: 0, reflects: 0 }),
    [current, pendingIn],
  );
  const ready = pending.checks + pending.exercises + pending.reflects === 0;
  const isLast = revealed >= last;

  const advance = useCallback(() => {
    setRevealed((r) => Math.min(r + 1, last));
  }, [last]);

  /** Defers every unresolved exercise of the current step. */
  const deferExercises = useCallback(() => {
    if (!current) return;
    setDeferred((s) => {
      const n = new Set(s);
      for (const b of current.blocks) if (b.type === 'exercise' && !resolved.has(b.id)) n.add(b.id);
      return n;
    });
  }, [current, resolved]);

  const reset = useCallback(() => {
    setRevealed(0);
    setResolved(new Set());
    setDeferred(new Set());
    setOutcomes({});
  }, []);

  /** Top-bar segments. `all` marks every step done (completion screen). */
  const segments = useCallback(
    (state: 'before' | 'steps' | 'all'): Segment[] =>
      lesson.steps.map((step, i) => {
        const label = plainTitle(step, i);
        if (state === 'all') return { fill: 1, state: 'done', label };
        if (state === 'before' || i > revealed) return { fill: 0, state: 'todo', label };
        if (i < revealed) return { fill: 1, state: 'done', label };
        const items = gatingBlocks(step);
        const open = items.filter((b) => !resolved.has(b.id) && !deferred.has(b.id)).length;
        return { fill: items.length ? 0.12 + (0.88 * (items.length - open)) / items.length : 1, state: 'current', label };
      }),
    [lesson.steps, revealed, resolved, deferred],
  );

  return {
    revealed,
    setRevealed,
    resolved,
    deferred,
    outcomes,
    onBlockComplete,
    pending,
    ready,
    isLast,
    advance,
    deferExercises,
    reset,
    segments,
  };
}

export function plainTitle(step: Step, index: number): string {
  const t = step.title.replace(/[`*_]/g, '').trim();
  return t || (index === 0 ? 'Giriş' : `${index + 1}. adım`);
}
