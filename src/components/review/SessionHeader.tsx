// Top bar of a running session: exit, animated progress, earned XP (with "+N" bursts) and a clock.
import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Timer, X, Zap } from 'lucide-react';
import { Button } from '../ui/Button';
import { ProgressBar } from '../ui/primitives';
import { formatClock } from '../../lib/stats';
import { useElapsed } from './shared/hooks';

export function SessionClock({ start, running = true }: { start: number; running?: boolean }) {
  const secs = useElapsed(start, running);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-muted lx-tabular" aria-label={`Geçen süre ${formatClock(secs)}`}>
      <Timer className="size-4" aria-hidden />
      {formatClock(secs)}
    </span>
  );
}

export function XpCounter({ amount, burst }: { amount: number; burst?: { id: number; amount: number } | null }) {
  return (
    <span className="relative inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-sm font-semibold text-fg">
      <Zap className="size-4 text-xp" aria-hidden />
      <span className="lx-tabular" aria-label={`Bu oturumda ${amount} XP`}>
        {amount}
      </span>
      <span className="text-xs font-medium text-muted">XP</span>
      <AnimatePresence>
        {burst && (
          <motion.span
            key={burst.id}
            className="pointer-events-none absolute -top-1 right-1 text-sm font-bold text-xp"
            initial={{ opacity: 0, y: 4, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: -26, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            aria-hidden
          >
            +{burst.amount}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}

export default function SessionHeader({
  done,
  total,
  xp,
  burst,
  startedAt,
  onExit,
  exitLabel = 'Bitir',
  extra,
}: {
  done: number;
  total: number;
  xp: number;
  burst?: { id: number; amount: number } | null;
  startedAt: number;
  onExit: () => void;
  exitLabel?: string;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <Button variant="ghost" size="sm" icon={<X className="size-4" />} onClick={onExit}>
        {exitLabel}
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <ProgressBar value={total ? done / total : 0} height={10} />
        <span className="shrink-0 text-sm font-semibold text-muted lx-tabular" aria-label={`${total} öğeden ${done} tamamlandı`}>
          {done}/{total}
        </span>
      </div>
      {extra}
      <XpCounter amount={xp} burst={burst} />
      <SessionClock start={startedAt} />
    </div>
  );
}
