// A lesson block re-used outside the lesson (review / practice): a context line (where it comes from,
// why it was picked) above the lesson player's own block component (BlockRenderer), started fresh.
// The block draws its own card; this wrapper only adds context and, in sessions, depth.
import { useRef, type ReactNode } from 'react';
import clsx from 'clsx';
import { NotebookPen } from 'lucide-react';
import BlockRenderer from '../blocks/BlockRenderer';
import type { BlockMode, BlockOutcome } from '../blocks/types';
import { findBlock } from '../../lib/content';
import { BLOCK_TYPE_LABELS } from '../../lib/practice';
import { useProgress } from '../../store/progress';
import { ModuleTag } from './shared/ui';

export default function ItemSheet({
  blockId,
  mode,
  onOutcome,
  reasons,
  eyebrow,
  className,
  flat,
}: {
  blockId: string;
  mode: Extract<BlockMode, 'review' | 'practice'>;
  onOutcome: (o: BlockOutcome) => void;
  reasons?: string[];
  eyebrow?: ReactNode;
  className?: string;
  /** Inside another card: no drop shadow. */
  flat?: boolean;
}) {
  const loc = findBlock(blockId);
  const openMistake = useProgress((s) => !!s.mistakes[blockId] && !s.mistakes[blockId].resolved);
  const reported = useRef(false);
  if (!loc) return null;
  const handle = (o: BlockOutcome) => {
    if (reported.current) return;
    reported.current = true;
    onOutcome(o);
  };
  const shownReasons = (reasons ?? []).filter((r) => !(openMistake && (r === 'Hata defterinde' || r.endsWith('kez yanıldın')))).slice(0, 2);
  return (
    <article className={clsx('min-w-0', className)} aria-label={`${BLOCK_TYPE_LABELS[loc.block.type] ?? 'Soru'}: ${loc.lesson.title}`}>
      <header className="mb-2.5 flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {eyebrow && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{eyebrow}</span>}
          <ModuleTag module={loc.module} />
          <span className="truncate text-xs text-subtle">{loc.lesson.title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {openMistake && (
            <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">
              <NotebookPen className="size-3" aria-hidden /> Hata defterinde
            </span>
          )}
          {shownReasons.map((r) => (
            <span key={r} className="rounded-full border border-border bg-surface px-2 py-0.5 text-xs text-muted">
              {r}
            </span>
          ))}
        </div>
      </header>
      <div className={clsx('rounded-[18px]', !flat && 'shadow-[var(--lx-card-shadow)]')}>
        <BlockRenderer block={loc.block} lessonId={loc.lesson.id} mode={mode} fresh onComplete={handle} />
      </div>
    </article>
  );
}
