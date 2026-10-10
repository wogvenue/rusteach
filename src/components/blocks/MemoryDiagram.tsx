// Stack/heap diagram (dual coding). Pointers and references are SVG arrows measured from the DOM;
// multi-step diagrams animate between steps (moves, drops, new allocations).
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, MemoryStick, Pause, Play, RotateCcw } from 'lucide-react';
import type { MemoryBlock as MemoryBlockT, MemoryStep } from '../../types/content';
import type { BlockProps } from './types';
import BlockFrame from './BlockFrame';
import Html from './Html';
import { isTypingTarget } from '../editor/util';

type ArrowKind = 'ptr' | 'ref';
interface Arrow {
  key: string;
  d: string;
  kind: ArrowKind;
}

const varKey = (fi: number, frame: string, name: string) => `${fi}:${frame}:${name}`;
const EMPTY_STEP: MemoryStep = { caption: '', stack: [], heap: [] };
const STEP_MS = 2800;

function useArrows(step: MemoryStep, stepIndex: number) {
  const gridRef = useRef<HTMLDivElement>(null);
  const valueRefs = useRef(new Map<string, HTMLElement>());
  const heapRefs = useRef(new Map<string, HTMLElement>());
  const [arrows, setArrows] = useState<Arrow[]>([]);
  const lastSig = useRef('');

  const compute = useCallback(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const g = grid.getBoundingClientRect();
    const rel = (r: DOMRect) => ({
      left: r.left - g.left,
      right: r.right - g.left,
      top: r.top - g.top,
      bottom: r.bottom - g.top,
      cy: r.top - g.top + r.height / 2,
      width: r.width,
    });
    const list: Arrow[] = [];
    const findVar = (fi: number, name: string): HTMLElement | undefined => {
      const own = step.stack[fi];
      if (own?.vars.some((v) => v.name === name)) return valueRefs.current.get(varKey(fi, own.frame, name));
      for (let i = step.stack.length - 1; i >= 0; i--) {
        const f = step.stack[i];
        if (f.vars.some((v) => v.name === name)) return valueRefs.current.get(varKey(i, f.frame, name));
      }
      return undefined;
    };

    const toHeap = (srcEl: HTMLElement, heapEl: HTMLElement, key: string) => {
      const s = rel(srcEl.getBoundingClientRect());
      const h = rel(heapEl.getBoundingClientRect());
      const x1 = s.right - 10;
      const y1 = s.cy;
      if (h.left > x1 + 24) {
        const x2 = h.left - 3;
        const y2 = h.top + Math.min(h.bottom - h.top, 44) / 2;
        const dx = Math.max(36, (x2 - x1) * 0.5);
        list.push({ key, kind: 'ptr', d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}` });
      } else {
        // stacked layout (narrow): heap is below the stack
        const x2 = h.left + Math.min(h.width * 0.35, 80);
        const y2 = h.top - 3;
        const dy = Math.max(36, (y2 - y1) * 0.45);
        list.push({ key, kind: 'ptr', d: `M ${x1} ${y1} C ${x1 + 48} ${y1}, ${x2} ${y2 - dy}, ${x2} ${y2}` });
      }
    };

    const sideLoop = (srcEl: HTMLElement, dstEl: HTMLElement, key: string, kind: ArrowKind) => {
      const s = rel(srcEl.getBoundingClientRect());
      const t = rel(dstEl.getBoundingClientRect());
      const x1 = s.right - 10;
      const y1 = s.cy;
      const x2 = t.right + 3;
      const y2 = t.cy;
      const bx = Math.max(x1, x2) + 42;
      list.push({ key, kind, d: `M ${x1} ${y1} C ${bx} ${y1}, ${bx} ${y2}, ${x2} ${y2}` });
    };

    step.stack.forEach((frame, fi) =>
      frame.vars.forEach((v) => {
        if (!v.to || v.moved) return;
        const src = valueRefs.current.get(varKey(fi, frame.frame, v.name));
        if (!src) return;
        const heapEl = step.heap.some((h) => h.id === v.to) ? heapRefs.current.get(v.to) : undefined;
        if (heapEl) return toHeap(src, heapEl, `v-${fi}-${v.name}`);
        const target = findVar(fi, v.to);
        if (target && target !== src) sideLoop(src, target, `r-${fi}-${v.name}`, 'ref');
      }),
    );
    step.heap.forEach((h) => {
      if (!h.to || h.freed) return;
      const src = heapRefs.current.get(h.id);
      const dst = heapRefs.current.get(h.to);
      if (src && dst && src !== dst) sideLoop(src, dst, `h-${h.id}`, 'ptr');
    });

    const sig = list.map((a) => a.key + a.d).join('|');
    if (sig !== lastSig.current) {
      lastSig.current = sig;
      setArrows(list);
    }
  }, [step]);

  // follow layout animations for a moment after each step change
  useLayoutEffect(() => {
    compute();
    let raf = 0;
    const until = performance.now() + 750;
    const tick = () => {
      compute();
      if (performance.now() < until) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [compute, stepIndex]);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(grid);
    return () => ro.disconnect();
  }, [compute]);

  return { gridRef, valueRefs, heapRefs, arrows };
}

export default function MemoryDiagram({ block }: BlockProps<MemoryBlockT>) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const total = block.steps.length;
  const step = block.steps[Math.min(index, total - 1)] ?? EMPTY_STEP;
  const { gridRef, valueRefs, heapRefs, arrows } = useArrows(step, index);

  useEffect(() => {
    if (!playing) return;
    if (index >= total - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), STEP_MS);
    return () => clearTimeout(t);
  }, [playing, index, total]);

  const go = (i: number) => {
    setPlaying(false);
    setIndex(Math.max(0, Math.min(total - 1, i)));
  };

  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (index >= total - 1) setIndex(0);
    setPlaying(true);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (total < 2 || isTypingTarget(e.target)) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(index + 1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(index - 1);
    }
  };

  if (!total) return null;
  const kinds = new Set(arrows.map((a) => a.kind));

  return (
    <BlockFrame
      icon={<MemoryStick className="size-4" />}
      label="Bellek şeması"
      right={total > 1 ? <span className="text-xs font-medium tabular-nums text-muted">Adım {index + 1}/{total}</span> : undefined}
    >
      <div onKeyDown={onKeyDown}>
        {block.title && <Html as="div" html={block.title} prose={false} className="mb-4 text-[0.95rem] font-semibold text-fg" />}

        <div className="mem-wrap">
          <LayoutGroup id={uid}>
            <div ref={gridRef} className="mem-grid">
              {/* stack */}
              <div className="min-w-0">
                <div className="mem-col-title">
                  Stack <small>fonksiyon çerçeveleri</small>
                </div>
                {step.stack.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">Stack boş</div>
                )}
                <AnimatePresence initial={false} mode="popLayout">
                  {step.stack.map((frame, fi) => (
                    <motion.div
                      key={`${fi}:${frame.frame}`}
                      layout="position"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                      className="mem-frame"
                    >
                      <div className="mem-frame-head">{frame.frame}</div>
                      <AnimatePresence initial={false} mode="popLayout">
                        {frame.vars.map((v) => (
                          <motion.div
                            key={v.name}
                            layout="position"
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: v.moved ? 0.5 : 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.96 }}
                            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                            className="mem-var"
                            data-moved={v.moved || undefined}
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="mem-var-name">{v.name}</span>
                                {v.mut && <span className="mem-tag bg-[color-mix(in_srgb,var(--syn-modifier)_14%,transparent)] text-[var(--syn-modifier)]">mut</span>}
                                {v.moved && <span className="mem-tag bg-surface text-muted">taşındı</span>}
                              </div>
                              {v.type && <div className="mem-var-type">{v.type}</div>}
                            </div>
                            <span
                              ref={(el) => {
                                const k = varKey(fi, frame.frame, v.name);
                                if (el) valueRefs.current.set(k, el);
                                else valueRefs.current.delete(k);
                              }}
                              className="mem-value"
                              data-ptr={(!!v.to && !v.moved) || undefined}
                            >
                              {v.value}
                              {v.to && !v.moved && <span className="mem-dot" aria-hidden="true" />}
                            </span>
                            {v.note && !(v.moved && /^\s*taşındı\.?\s*$/i.test(v.note)) && (
                              <Html as="div" html={v.note} prose={false} className="col-span-2 text-xs leading-relaxed text-muted" />
                            )}
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* heap */}
              <div className="min-w-0">
                <div className="mem-col-title">
                  Heap <small>çalışma anında ayrılan bellek</small>
                </div>
                {step.heap.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-subtle">
                    Heap'te bir şey yok
                  </div>
                )}
                <AnimatePresence initial={false} mode="popLayout">
                  {step.heap.map((h) => (
                    <motion.div
                      key={h.id}
                      ref={(el: HTMLDivElement | null) => {
                        if (el) heapRefs.current.set(h.id, el);
                        else heapRefs.current.delete(h.id);
                      }}
                      layout="position"
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: h.freed ? 0.6 : 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ type: 'spring', stiffness: 360, damping: 30 }}
                      className="mem-heap-item"
                      data-freed={h.freed || undefined}
                    >
                      {(h.label || h.freed) && (
                        <div className="mb-1 flex items-center gap-1.5 text-[0.72rem] text-muted">
                          {h.label && <span>{h.label}</span>}
                          {h.freed && <span className="mem-tag bg-surface text-muted">serbest bırakıldı</span>}
                        </div>
                      )}
                      <div className="mem-heap-value">{h.value}</div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              <svg className="mem-arrows" aria-hidden="true">
                <defs>
                  <marker id={`${uid}-ptr`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--c-accent)" />
                  </marker>
                  <marker id={`${uid}-ref`} viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--tone-violet)" />
                  </marker>
                </defs>
                {arrows.map((a) => (
                  <path
                    key={a.key}
                    d={a.d}
                    fill="none"
                    stroke={a.kind === 'ptr' ? 'var(--c-accent)' : 'var(--tone-violet)'}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeDasharray={a.kind === 'ref' ? '5 4' : undefined}
                    markerEnd={`url(#${uid}-${a.kind})`}
                    opacity={0.9}
                  />
                ))}
              </svg>
            </div>
          </LayoutGroup>
        </div>

        {kinds.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.72rem] text-muted">
            {kinds.has('ptr') && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="1" y1="4" x2="21" y2="4" stroke="var(--c-accent)" strokeWidth="1.75" />
                </svg>
                işaretçi: veri heap'te
              </span>
            )}
            {kinds.has('ref') && (
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="8" aria-hidden="true">
                  <line x1="1" y1="4" x2="21" y2="4" stroke="var(--tone-violet)" strokeWidth="1.75" strokeDasharray="5 4" />
                </svg>
                referans: ödünç alınan değer
              </span>
            )}
          </div>
        )}

        <div className={clsx('mt-4 rounded-xl bg-surface-2/70 px-4 py-3', total > 1 && 'min-h-[3.4rem]')} aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              <Html html={step.caption} size="sm" />
            </motion.div>
          </AnimatePresence>
        </div>

        {total > 1 && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => go(index - 1)}
              disabled={index === 0}
              className="grid size-9 place-items-center rounded-xl border border-border text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label="Önceki adım"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-fg transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {playing ? (
                <>
                  <Pause className="size-4" /> Duraklat
                </>
              ) : index >= total - 1 ? (
                <>
                  <RotateCcw className="size-4" /> Baştan oynat
                </>
              ) : (
                <>
                  <Play className="size-4" /> Oynat
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              disabled={index >= total - 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-strong disabled:bg-surface-2 disabled:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              Sonraki adım <ChevronRight className="size-4" />
            </button>
            <span className="flex-1" />
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {block.steps.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  onClick={() => go(i)}
                  className={clsx('h-1.5 rounded-full transition-all', i === index ? 'w-5 bg-accent' : i < index ? 'w-1.5 bg-accent/45' : 'w-1.5 bg-border-strong')}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </BlockFrame>
  );
}
