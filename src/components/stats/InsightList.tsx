// Personal, plain-language observations drawn from the learner's data (strongest module, topic to
// revisit, most productive hours, memory, calibration, weekly trend, streak).
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, BrainCircuit, Clock3, Compass, Flame, Gauge, Target, TrendingUp, Trophy } from 'lucide-react';
import clsx from 'clsx';
import type { Insight, InsightKind } from '../../lib/stats';

const ICONS: Record<InsightKind, ComponentType<{ className?: string }>> = {
  strength: Trophy,
  focus: Target,
  hours: Clock3,
  trend: TrendingUp,
  memory: BrainCircuit,
  calibration: Gauge,
  streak: Flame,
  start: Compass,
};

const TONE = {
  good: { icon: 'bg-success-soft text-success', ring: 'hover:border-success/35' },
  focus: { icon: 'bg-accent-soft text-accent', ring: 'hover:border-accent/35' },
  neutral: { icon: 'bg-info-soft text-info', ring: 'hover:border-info/35' },
} as const;

export default function InsightList({ insights }: { insights: Insight[] }) {
  return (
    <section aria-labelledby="stats-insights-title">
      <h2 id="stats-insights-title" className="sr-only">
        Sana özel gözlemler
      </h2>
      <ul
        className={clsx(
          'grid gap-3',
          insights.length > 1 && '@2xl:grid-cols-2',
          insights.length === 3 && '@5xl:grid-cols-3',
          insights.length >= 4 && '@5xl:grid-cols-4',
        )}
      >
        {insights.map((ins, i) => {
          const Icon = ICONS[ins.kind];
          const tone = TONE[ins.tone];
          return (
            <motion.li
              key={`${ins.kind}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 + i * 0.05, type: 'spring', stiffness: 260, damping: 26 }}
              className={clsx('flex flex-col rounded-3xl border border-border bg-surface p-4 transition-colors', tone.ring)}
            >
              <div className="flex items-center gap-2.5">
                <span className={clsx('grid size-8 shrink-0 place-items-center rounded-xl', tone.icon)}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <h3 className="text-sm font-semibold leading-snug text-fg">{ins.title}</h3>
              </div>
              <p className="mt-2.5 text-sm leading-relaxed text-muted">{ins.text}</p>
              {ins.link && (
                <Link
                  to={ins.link.to}
                  className="group mt-auto inline-flex items-center gap-1 self-start rounded-md pt-3 text-sm font-semibold text-accent outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {ins.link.label}
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
              )}
            </motion.li>
          );
        })}
      </ul>
    </section>
  );
}
