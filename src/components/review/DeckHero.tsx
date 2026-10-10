// The review hero: a small fanned deck whose top card carries the number of due cards.
import { motion } from 'framer-motion';
import { formatNumber } from '../../lib/stats';

export default function DeckHero({ count, colors, caption }: { count: number; colors: string[]; caption: string }) {
  const back = [colors[1] ?? colors[0] ?? 'var(--c-accent)', colors[2] ?? colors[0] ?? 'var(--c-info)'];
  return (
    <motion.div className="relative mx-auto h-[232px] w-[300px] select-none" initial="rest" animate="rest" whileHover="hover" aria-hidden>
      {[1, 0].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-x-6 top-4 h-[196px] rounded-[26px] border border-border bg-surface-2"
          style={{ transformOrigin: '50% 100%' }}
          variants={{
            rest: { rotate: i ? -7 : 5, x: i ? -14 : 12, y: i ? 6 : 2 },
            hover: { rotate: i ? -12 : 9, x: i ? -30 : 26, y: i ? 4 : 0 },
          }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        >
          <div className="absolute inset-x-5 top-4 h-1.5 rounded-full opacity-80" style={{ background: back[i] }} />
          <div className="absolute inset-x-5 top-9 space-y-2 opacity-40">
            <div className="h-2 w-3/4 rounded-full bg-border-strong" />
            <div className="h-2 w-1/2 rounded-full bg-border-strong" />
          </div>
        </motion.div>
      ))}
      <motion.div
        className="lx-card-surface absolute inset-x-6 top-4 flex h-[196px] flex-col items-center justify-center rounded-[26px] border border-border-strong"
        variants={{ rest: { y: 0 }, hover: { y: -6 } }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <div className="absolute inset-x-5 top-4 h-1.5 rounded-full bg-accent" />
        <div className="text-[76px] font-semibold leading-none tracking-[-0.04em] text-fg">{formatNumber(count)}</div>
        <div className="mt-2 text-sm font-medium text-muted">{caption}</div>
      </motion.div>
    </motion.div>
  );
}
