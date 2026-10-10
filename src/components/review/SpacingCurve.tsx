// Teaching illustration: a memory without review fades within days; each well-timed review resets it
// and makes it fade more slowly (the spacing effect). Curves use the same FSRS forgetting curve as
// the scheduler.
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { forgettingCurve } from '../../lib/srs';

const W = 320;
const H = 150;
const PAD = { l: 14, r: 12, t: 16, b: 26 };
const DAYS = 30;
const REVIEWS = [1, 3, 7, 16];
const STABILITY = [1, 2.6, 6.5, 15, 40];

const x = (d: number) => PAD.l + (d / DAYS) * (W - PAD.l - PAD.r);
const y = (r: number) => PAD.t + (1 - r) * (H - PAD.t - PAD.b);

function spacedPath(): string {
  const starts = [0, ...REVIEWS];
  let d = '';
  starts.forEach((start, i) => {
    const end = starts[i + 1] ?? DAYS;
    for (let t = start; t <= end + 1e-9; t += 0.25) {
      const r = forgettingCurve(t - start, STABILITY[i]);
      d += `${t === start ? (i === 0 ? 'M' : 'L') : 'L'}${x(t).toFixed(1)},${y(r).toFixed(1)} `;
    }
  });
  return d.trim();
}

function plainPath(): string {
  let d = '';
  for (let t = 0; t <= DAYS + 1e-9; t += 0.25) d += `${t === 0 ? 'M' : 'L'}${x(t).toFixed(1)},${y(forgettingCurve(t, STABILITY[0])).toFixed(1)} `;
  return d.trim();
}

export default function SpacingCurve({ className }: { className?: string }) {
  const spaced = useMemo(spacedPath, []);
  const plain = useMemo(plainPath, []);
  return (
    <figure className={clsx('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-labelledby="spacing-curve-title">
        <title id="spacing-curve-title">
          Tekrarsız bir bilgi birkaç günde unutulur; 1., 3., 7. ve 16. günlerde yapılan tekrarlar hatırlamayı her seferinde daha uzun süre yüksek tutar.
        </title>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <line key={r} x1={PAD.l} x2={W - PAD.r} y1={y(r)} y2={y(r)} stroke="var(--lx-grid)" strokeWidth={1} />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} stroke="var(--c-border-strong)" strokeWidth={1} />
        <motion.path
          d={plain}
          fill="none"
          stroke="var(--lx-chart-muted)"
          strokeWidth={2}
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
        />
        <motion.path
          d={spaced}
          fill="none"
          stroke="var(--lx-chart-1)"
          strokeWidth={2.25}
          strokeLinejoin="round"
          strokeLinecap="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.8, ease: 'easeOut', delay: 0.2 }}
        />
        {REVIEWS.map((d, i) => (
          <motion.g key={d} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 + i * 0.25 }}>
            <circle cx={x(d)} cy={y(1)} r={4} fill="var(--lx-chart-1)" stroke="var(--c-surface)" strokeWidth={2} />
            <text x={x(d)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--c-muted)">
              {d}. gün
            </text>
          </motion.g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-(--lx-chart-1)" aria-hidden /> Aralıklı tekrarla
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-(--lx-chart-muted)" aria-hidden /> Tekrar etmeden
        </span>
      </figcaption>
    </figure>
  );
}
