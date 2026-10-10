// Focus-mode top bar: exit, module + lesson title, segmented step progress, session XP and notes.
// Doubles as the Electron window drag region; on Windows the native caption buttons sit at the right.
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { NotebookPen, X } from 'lucide-react';
import type { Lesson, Module } from '../../types/content';
import { AnimatedNumber } from '../ui/AnimatedNumber';

/** Space kept free for the Windows title bar overlay buttons in Electron. */
const OVERLAY_WIDTH = 140;

export interface Segment {
  /** 0..1 fill */
  fill: number;
  state: 'done' | 'current' | 'todo';
  label: string;
}

export function SegmentedProgress({ segments, onJump }: { segments: Segment[]; onJump?: (i: number) => void }) {
  const done = segments.filter((s) => s.state === 'done').length;
  return (
    <div
      className="seg-progress w-full"
      role="progressbar"
      aria-label="Ders ilerlemesi"
      aria-valuemin={0}
      aria-valuemax={segments.length}
      aria-valuenow={done}
    >
      {segments.map((s, i) => {
        const clickable = !!onJump && s.state !== 'todo';
        const fill = (
          <motion.span
            className="seg-fill"
            initial={false}
            animate={{ width: `${Math.round(s.fill * 100)}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
            style={s.state === 'current' ? { boxShadow: '0 0 10px var(--c-glow)' } : undefined}
          />
        );
        return clickable ? (
          <button key={i} type="button" className="no-drag" onClick={() => onJump?.(i)} title={s.label} aria-label={`${i + 1}. adıma git: ${s.label}`}>
            {fill}
          </button>
        ) : (
          <span key={i} title={s.label}>
            {fill}
          </span>
        );
      })}
    </div>
  );
}

export default function LessonTopBar({
  module,
  lesson,
  segments,
  onJump,
  sessionXp,
  onExit,
  notesOpen,
  onToggleNotes,
  right,
}: {
  module?: Module;
  lesson: Lesson;
  segments: Segment[];
  onJump?: (i: number) => void;
  sessionXp?: number;
  onExit: () => void;
  notesOpen?: boolean;
  onToggleNotes?: () => void;
  right?: ReactNode;
}) {
  const electron = typeof window !== 'undefined' && !!window.rusteach;
  return (
    <header
      className="drag-region relative z-30 grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_minmax(8rem,22rem)_minmax(0,1fr)] items-center gap-4 border-b border-border bg-[color-mix(in_oklab,var(--c-bg)_84%,transparent)] pl-3 backdrop-blur-md"
      style={{ paddingRight: electron ? OVERLAY_WIDTH + 8 : 16 }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onExit}
          className="no-drag grid size-9 shrink-0 place-items-center rounded-xl text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label="Dersten çık"
          title="Dersten çık (ilerlemen kaydedilir)"
        >
          <X className="size-5" />
        </button>
        <div className="min-w-0 leading-tight">
          {module && (
            <div className="truncate text-[0.7rem] font-medium text-subtle">
              Modül {module.number}: {module.title}
            </div>
          )}
          <div className="truncate text-sm font-semibold text-fg">{lesson.title}</div>
        </div>
      </div>

      <SegmentedProgress segments={segments} onJump={onJump} />

      <div className="flex min-w-0 items-center justify-end gap-1.5">
        {right}
        {sessionXp !== undefined && (
          <span
            className={clsx(
              'inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs font-bold tabular-nums transition-colors',
              sessionXp > 0 ? 'bg-xp/15 text-xp' : 'bg-surface-2 text-subtle',
            )}
            title="Bu derste kazandığın XP"
          >
            <span>
              +<AnimatedNumber value={sessionXp} />
            </span>
            XP
          </span>
        )}
        {onToggleNotes && (
          <button
            type="button"
            onClick={onToggleNotes}
            aria-pressed={notesOpen}
            className={clsx(
              'no-drag grid size-9 place-items-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              notesOpen ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-fg',
            )}
            aria-label="Notlarım"
            title="Notlarım"
          >
            <NotebookPen className="size-[1.1rem]" />
          </button>
        )}
      </div>
    </header>
  );
}
