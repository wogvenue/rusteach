// Parsons problem: drag the shuffled lines (plus a few traps) into the right order.
// Pointer + keyboard dragging via dnd-kit; Enter/click moves a line between the two areas.
// Misplaced lines are found with a longest-common-subsequence match against the correct order.
import { useCallback, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { GripVertical, ListOrdered, Play, Undo2, X } from 'lucide-react';
import type { ParsonsBlock as ParsonsBlockT, ParsonsLine } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import CodeView from '../editor/CodeView';
import RunOutput from '../editor/RunOutput';
import { useRunner } from '../editor/useRunner';
import { highlightRust } from '../editor/highlight';
import { shuffleSeeded } from '../editor/util';
import { hasMain } from '../../lib/runner';
import { FeedbackPanel } from './CheckUi';
import { useCheckFlow } from './useCheckFlow';

type Zone = 'program' | 'pool';
interface Item extends ParsonsLine {
  id: string;
  distractor: boolean;
}
interface Layout {
  program: string[];
  pool: string[];
}

const same = (a: ParsonsLine, b: ParsonsLine) => a.text.trim() === b.text.trim() && a.indent === b.indent;

/** true for lines that belong to a longest common subsequence with the correct order. */
function lcsMarks(program: Item[], target: ParsonsLine[]): boolean[] {
  const n = program.length;
  const m = target.length;
  const dp = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = same(program[i], target[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const marks = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (same(program[i], target[j])) {
      marks[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return marks;
}

function LineText({ text }: { text: string }) {
  const tokens = useMemo(() => highlightRust(text.trim())[0] ?? [], [text]);
  return (
    <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-pre">
      {tokens.map((t, i) => (
        <span key={i} className={t.cls || undefined}>
          {t.text}
        </span>
      ))}
    </span>
  );
}

function SortableLine({
  item,
  zone,
  mark,
  disabled,
  onToggle,
}: {
  item: Item;
  zone: Zone;
  mark?: 'correct' | 'wrong';
  disabled: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id, disabled });
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!disabled && !isDragging && (e.key === 'Enter' || (zone === 'program' && (e.key === 'Delete' || e.key === 'Backspace')))) {
      e.preventDefault();
      onToggle();
      return;
    }
    listeners?.onKeyDown?.(e);
  };
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onKeyDown={onKeyDown}
      onClick={!disabled && zone === 'pool' ? onToggle : undefined}
      className={clsx('parsons-line group', !disabled && 'cursor-grab', zone === 'pool' && !disabled && 'hover:bg-surface-2')}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        marginLeft: zone === 'program' ? `${item.indent * 1.75}rem` : undefined,
      }}
      data-dragging={isDragging || undefined}
      data-result={mark}
      aria-label={`${item.text.trim()}${zone === 'program' ? ' (programda)' : ''}`}
    >
      <GripVertical className="size-4 shrink-0 text-subtle" aria-hidden="true" />
      <LineText text={item.text} />
      {zone === 'program' && !disabled && (
        <button
          type="button"
          tabIndex={-1}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-subtle opacity-0 transition-opacity hover:bg-surface-2 hover:text-fg group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-label="Satırı programdan çıkar"
          title="Programdan çıkar"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}

function DropZone({ id, children, className, empty }: { id: Zone; children: ReactNode; className?: string; empty: string | null }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx('parsons-drop p-2', className)} data-over={isOver || undefined}>
      {children}
      {empty && <p className="grid min-h-12 place-items-center px-3 text-center text-xs text-subtle">{empty}</p>}
    </div>
  );
}

export default function ParsonsBlock({ block, lessonId, mode, onComplete, fresh }: BlockProps<ParsonsBlockT>) {
  const flow = useCheckFlow<{ program: string[] }>({
    blockId: block.id,
    lessonId,
    mode,
    fresh,
    onComplete,
    allowRetry: true,
    askConfidence: false,
    maxWrong: 3,
  });

  const items = useMemo(() => {
    const map = new Map<string, Item>();
    block.lines.forEach((l, i) => map.set(`L${i}`, { ...l, id: `L${i}`, distractor: false }));
    block.distractors.forEach((l, i) => map.set(`D${i}`, { ...l, id: `D${i}`, distractor: true }));
    return map;
  }, [block]);

  const [layout, setLayout] = useState<Layout>(() => {
    const all = shuffleSeeded([...items.keys()], block.id);
    const saved = (flow.answer?.program ?? []).filter((id) => items.has(id));
    return { program: saved, pool: all.filter((id) => !saved.includes(id)) };
  });
  const [marks, setMarks] = useState<boolean[] | null>(() =>
    flow.restored ? lcsMarks(layout.program.map((id) => items.get(id)!), block.lines) : null,
  );
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const runner = useRunner();
  const lastChecked = useRef<string | null>(flow.restored ? layout.program.join(',') : null);

  const locked = flow.phase === 'done';
  const evaluated = (flow.phase === 'pending' || flow.phase === 'done') && flow.correct !== null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space', 'Enter'] },
    }),
  );

  const edited = useCallback(() => {
    setMarks(null);
    if (flow.phase === 'pending') flow.retry();
  }, [flow]);

  const zoneOf = useCallback(
    (id: UniqueIdentifier): Zone | null => {
      if (id === 'program' || id === 'pool') return id;
      if (layout.program.includes(String(id))) return 'program';
      if (layout.pool.includes(String(id))) return 'pool';
      return null;
    },
    [layout],
  );

  const toggle = (id: string) => {
    if (locked) return;
    setLayout((l) =>
      l.program.includes(id)
        ? { program: l.program.filter((x) => x !== id), pool: [...l.pool, id] }
        : { program: [...l.program, id], pool: l.pool.filter((x) => x !== id) },
    );
    edited();
  };

  const onDragStart = (e: DragStartEvent) => setActiveId(e.active.id);

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = zoneOf(active.id);
    const to = zoneOf(over.id);
    if (!from || !to || from === to) return;
    setLayout((l) => {
      const id = String(active.id);
      const target = l[to].filter((x) => x !== id);
      const overIndex = target.indexOf(String(over.id));
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, id);
      return { ...l, [from]: l[from].filter((x) => x !== id), [to]: target } as Layout;
    });
    edited();
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over) return;
    const zone = zoneOf(active.id);
    if (!zone || zone !== zoneOf(over.id)) return;
    const list = layout[zone];
    const a = list.indexOf(String(active.id));
    const b = list.indexOf(String(over.id));
    if (a >= 0 && b >= 0 && a !== b) {
      setLayout((l) => ({ ...l, [zone]: arrayMove(l[zone], a, b) }));
      edited();
    }
  };

  const check = () => {
    if (locked || !layout.program.length) return;
    const key = layout.program.join(',');
    if (flow.phase === 'pending' && key === lastChecked.current) return;
    const program = layout.program.map((id) => items.get(id)!);
    const m = lcsMarks(program, block.lines);
    const ok = program.length === block.lines.length && m.every(Boolean);
    lastChecked.current = key;
    setMarks(m);
    flow.submit({ program: layout.program }, ok);
  };

  const reset = () => {
    setLayout({ program: [], pool: shuffleSeeded([...items.keys()], block.id) });
    edited();
  };

  const label = (id: UniqueIdentifier) => items.get(String(id))?.text.trim() ?? '';
  const zoneName = (id: UniqueIdentifier) => (zoneOf(id) === 'program' ? 'program alanı' : 'kullanılmayan satırlar');
  const announcements: Announcements = {
    onDragStart: ({ active }) => `“${label(active.id)}” satırı tutuldu.`,
    onDragOver: ({ active, over }) =>
      over ? `“${label(active.id)}” şimdi ${zoneName(over.id)} içinde.` : `“${label(active.id)}” bir bırakma alanının dışında.`,
    onDragEnd: ({ active, over }) =>
      over ? `“${label(active.id)}” ${zoneName(over.id)} içine bırakıldı.` : `“${label(active.id)}” bırakıldı.`,
    onDragCancel: ({ active }) => `Taşıma iptal edildi; “${label(active.id)}” eski yerine döndü.`,
  };

  const programItems = layout.program.map((id) => items.get(id)!);
  const correctCount = marks ? marks.filter(Boolean).length : 0;
  const wrongCount = marks ? marks.length - correctCount : 0;
  const missing = Math.max(0, block.lines.length - programItems.filter((it) => !it.distractor).length);
  const pendingText = [
    wrongCount ? `${wrongCount} satır yanlış yerde ya da bu programa ait değil (kırmızı olanlar).` : '',
    missing ? `${missing} satır hâlâ eksik.` : '',
    'Satırları yeniden düzenleyip tekrar kontrol et.',
  ]
    .filter(Boolean)
    .join(' ');

  const activeItem = activeId ? items.get(String(activeId)) : undefined;
  const frameState = evaluated ? (flow.correct ? 'correct' : 'incorrect') : 'idle';
  const showSolution = flow.revealed && !flow.correct;

  return (
    <BlockFrame icon={<ListOrdered className="size-4" />} label="Satırları sırala" state={frameState}>
      <Html html={block.prompt} className="font-medium" />
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              'Satırı tutmak için Boşluk tuşuna bas, ok tuşlarıyla taşı, bırakmak için yeniden Boşluk tuşuna bas. Esc taşımayı iptal eder. Enter satırı programa ekler ya da programdan çıkarır.',
          },
        }}
      >
        <div className="mt-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
            <span>Programın</span>
            <span className="font-normal text-subtle">
              {layout.program.length}/{block.lines.length} satır
            </span>
            <span className="flex-1" />
            {!locked && layout.program.length > 0 && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 font-medium text-subtle hover:bg-surface-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Undo2 className="size-3.5" /> Baştan başla
              </button>
            )}
          </div>
          <SortableContext id="program" items={layout.program} strategy={verticalListSortingStrategy}>
            <DropZone
              id="program"
              className="min-h-16 space-y-1.5 bg-[var(--code-bg)]/40"
              empty={layout.program.length ? null : 'Satırları buraya sürükle ya da aşağıdan tıklayarak ekle.'}
            >
              {programItems.map((it, i) => (
                <SortableLine
                  key={it.id}
                  item={it}
                  zone="program"
                  disabled={locked}
                  mark={marks ? (marks[i] ? 'correct' : 'wrong') : undefined}
                  onToggle={() => toggle(it.id)}
                />
              ))}
            </DropZone>
          </SortableContext>
        </div>

        {(!locked || layout.pool.length > 0) && (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
              Kullanılmayanlar
              {block.distractors.length > 0 && (
                <span className="font-normal text-subtle">Dikkat: aralarında programa ait olmayan satırlar var.</span>
              )}
            </div>
            <SortableContext id="pool" items={layout.pool} strategy={verticalListSortingStrategy}>
              <DropZone id="pool" className="space-y-1.5" empty={layout.pool.length ? null : 'Tüm satırları kullandın.'}>
                {layout.pool.map((id) => (
                  <SortableLine key={id} item={items.get(id)!} zone="pool" disabled={locked} onToggle={() => toggle(id)} />
                ))}
              </DropZone>
            </SortableContext>
          </div>
        )}

        <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
          {activeItem ? (
            <div className="parsons-line" data-overlay="true">
              <GripVertical className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <LineText text={activeItem.text} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {!evaluated && !locked && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={check}
            disabled={!layout.program.length}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
          >
            Kontrol et
          </button>
          <span className="text-xs text-muted">
            Sürükle-bırak ya da satıra odaklanıp <span className="kbd-hint">Boşluk</span> ile tut, oklarla taşı.
          </span>
        </div>
      )}

      {evaluated && (
        <FeedbackPanel
          key={flow.pulse}
          correct={!!flow.correct}
          revealed={flow.revealed}
          explanation={block.explanation || undefined}
          xp={flow.xp}
          mode={mode}
          seed={`${block.id}-${flow.attempts}`}
          onRetry={flow.phase === 'pending' ? edited : undefined}
          onReveal={flow.phase === 'pending' ? flow.reveal : undefined}
          pendingText={pendingText}
        >
          {showSolution && (
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold text-muted">Doğru sıra</div>
              <div className="overflow-hidden rounded-xl border border-[var(--code-border)]">
                <CodeView code={block.source} ariaLabel="Doğru program" />
              </div>
            </div>
          )}
        </FeedbackPanel>
      )}

      {flow.revealed && block.verify && mode !== 'boss' && (
        <div className="mt-4">
          {!runner.result && !runner.running ? (
            <button
              type="button"
              onClick={() => runner.run({ code: block.source, mode: hasMain(block.source) ? 'run' : 'compile' })}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface-2 px-3.5 text-sm font-semibold text-fg transition-colors hover:border-border-strong hover:bg-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <Play className="size-4 text-accent" /> Programı çalıştır
            </button>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[var(--code-border)]">
              <RunOutput
                result={runner.result}
                running={runner.running}
                mode={runner.mode}
                startedAt={runner.startedAt}
                onClose={runner.clear}
              />
            </div>
          )}
        </div>
      )}
    </BlockFrame>
  );
}
