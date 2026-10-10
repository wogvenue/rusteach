import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight, Lightbulb } from 'lucide-react';
import { TIPS, tipIndexForDay } from './tips';

export default function TipCard({ className }: { className?: string }) {
  const [offset, setOffset] = useState(0);
  const base = tipIndexForDay();
  const idx = (((base + offset) % TIPS.length) + TIPS.length) % TIPS.length;
  const tip = TIPS[idx];
  const [dir, setDir] = useState(1);
  const move = (d: number) => {
    setDir(d);
    setOffset((o) => o + d);
  };

  return (
    <section
      aria-labelledby="tip-title"
      className={clsx('relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface p-5 shadow-card', className)}
    >
      <div className="flex items-center justify-between">
        <h2 id="tip-title" className="flex items-center gap-2 text-[15px] font-semibold text-fg">
          <span className="grid size-7 place-items-center rounded-lg bg-warning-soft text-warning">
            <Lightbulb className="size-4" aria-hidden />
          </span>
          {offset === 0 ? 'Günün ipucu' : 'Öğrenme ipucu'}
        </h2>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => move(-1)}
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Önceki ipucu"
          >
            <ChevronLeft className="size-4" />
          </button>
          <span className="w-10 text-center text-[11px] tabular-nums text-subtle" aria-hidden>
            {idx + 1}/{TIPS.length}
          </span>
          <button
            type="button"
            onClick={() => move(1)}
            className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-fg"
            aria-label="Sonraki ipucu"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="relative mt-4 flex-1" aria-live="polite">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={idx}
            initial={{ opacity: 0, x: dir * 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -12, transition: { duration: 0.1 } }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
          >
            <div className="flex items-start gap-3">
              <span className="text-[28px] leading-none" aria-hidden>
                {tip.icon}
              </span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-fg">{tip.title}</h3>
                <p className="mt-1.5 text-sm leading-6 text-muted">{tip.body}</p>
                {tip.source && <p className="mt-2 text-xs text-subtle">Kaynak: {tip.source}</p>}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </section>
  );
}
