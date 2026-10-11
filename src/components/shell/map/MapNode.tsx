// One module on the journey map: a tactile "coin" (press-down 3D edge), its state decorations,
// a side label and - for the current module - Ferris saying "Buradasın".
import { forwardRef, type CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import clsx from 'clsx';
import { ChevronsRight, Crown, Lock, Swords } from 'lucide-react';
import Ferris from '../../Ferris';
import type { ModuleStatus } from '../../../store/progress';
import { STATUS_LABEL } from '../stats';
import { LABEL_W, NODE, type NodeLayout } from './layout';

export interface MapNodeInfo {
  status: ModuleStatus;
  progress: number; // 0..1 (lessons + boss)
  lessonsDone: number;
  lessonsTotal: number;
  skipTest: boolean;
}

const RING = NODE + 20;

export const MapNode = forwardRef<HTMLAnchorElement, {
  node: NodeLayout;
  info: MapNodeInfo;
  current: boolean;
  reduced: boolean;
  /** Hover/focus changes; the page anchors its tooltip on the node element. */
  onHover: (node: NodeLayout | null) => void;
}>(function MapNode({ node, info, current, reduced, onHover }, ref) {
  const navigate = useNavigate();
  const { module: m, x, y, labelSide } = node;
  const { status } = info;
  const locked = status === 'locked';
  const mastered = status === 'mastered';
  const to = `/modul/${m.id}`;

  const coinStyle: CSSProperties = locked
    ? {
        ['--edge' as string]: 'var(--c-border-strong)',
        background: 'var(--c-surface-2)',
        border: '2px dashed var(--c-border-strong)',
      }
    : {
        ['--edge' as string]: 'color-mix(in oklab, var(--tier) 58%, #000)',
        background:
          'radial-gradient(120% 100% at 50% 0%, color-mix(in oklab, var(--tier) 72%, #fff) 0%, var(--tier) 58%, color-mix(in oklab, var(--tier) 86%, #000) 100%)',
      };

  const statusLine =
    status === 'in_progress'
      ? `${info.lessonsDone}/${info.lessonsTotal} ders`
      : status === 'available' && info.lessonsTotal
        ? `${info.lessonsTotal} ders`
        : STATUS_LABEL[status];

  const aria = `Modül ${m.number}: ${m.title}. ${STATUS_LABEL[status]}${
    status === 'in_progress' ? `, ${info.lessonsDone}/${info.lessonsTotal} ders tamamlandı` : ''
  }${current ? '. Buradasın' : ''}.`;

  const labelLeft = labelSide === 'left';
  const labelX = labelLeft ? x - NODE / 2 - 20 - LABEL_W : x + NODE / 2 + 20;

  return (
    <>
      {/* node */}
      <div
        className="absolute"
        style={{ left: x - NODE / 2, top: y - NODE / 2, width: NODE, height: NODE, ['--tier' as string]: node.tier.color }}
        onPointerEnter={() => onHover(node)}
        onPointerLeave={() => onHover(null)}
      >
        {status === 'available' && (
          <span className="pointer-events-none absolute inset-0 animate-pulse-ring rounded-full" style={{ boxShadow: '0 0 0 4px var(--tier)' }} aria-hidden />
        )}
        {(status === 'in_progress' || status === 'completed' || mastered) && (
          <svg
            className="pointer-events-none absolute -rotate-90"
            width={RING}
            height={RING}
            style={{ left: (NODE - RING) / 2, top: (NODE - RING) / 2 }}
            aria-hidden
          >
            <circle cx={RING / 2} cy={RING / 2} r={RING / 2 - 3} fill="none" stroke="color-mix(in oklab, var(--c-fg) 10%, transparent)" strokeWidth="5" />
            <motion.circle
              cx={RING / 2}
              cy={RING / 2}
              r={RING / 2 - 3}
              fill="none"
              stroke={mastered ? 'var(--c-gold)' : 'var(--tier)'}
              strokeWidth="5"
              strokeLinecap="round"
              initial={reduced ? false : { pathLength: 0 }}
              animate={{ pathLength: Math.max(0.02, mastered ? 1 : info.progress) }}
              transition={{ duration: reduced ? 0 : 0.9, ease: [0.16, 1, 0.3, 1], delay: reduced ? 0 : 0.25 }}
            />
          </svg>
        )}
        <Link
          ref={ref}
          id={`node-${m.id}`}
          to={to}
          aria-label={aria}
          onFocus={() => onHover(node)}
          onBlur={() => onHover(null)}
          className={clsx(
            'group relative grid size-full place-items-center rounded-full outline-none [--depth:6px]',
            'shadow-[0_var(--depth)_0_var(--edge),0_calc(var(--depth)+10px)_22px_-10px_var(--edge)] transition-[transform,box-shadow] duration-150 ease-out',
            'hover:-translate-y-0.5 hover:[--depth:8px] active:translate-y-1 active:[--depth:2px]',
            'focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklab,var(--c-accent)_70%,transparent)] focus-visible:ring-offset-4 focus-visible:ring-offset-bg',
            mastered && 'ring-[3px] ring-gold ring-offset-[3px] ring-offset-[color-mix(in_oklab,var(--tier)_40%,#000)]',
          )}
          style={coinStyle}
        >
          <span
            className={clsx('select-none text-[34px] leading-none drop-shadow-[0_2px_1px_rgb(0_0_0/0.25)]', locked && 'opacity-45 grayscale')}
            aria-hidden
          >
            {m.icon}
          </span>
          {/* glossy highlight */}
          {!locked && (
            <span
              className="pointer-events-none absolute inset-x-3 top-1.5 h-1/3 rounded-full bg-gradient-to-b from-white/35 to-transparent"
              aria-hidden
            />
          )}
        </Link>

        {mastered && (
          <span
            className="pointer-events-none absolute left-1/2 top-0 grid size-8 -translate-x-1/2 -translate-y-[62%] place-items-center rounded-full border-2 border-bg bg-gold text-[#2a1a00] shadow-[0_4px_10px_-2px_rgb(0_0_0/0.4)]"
            aria-hidden
          >
            <Crown className="size-4" strokeWidth={2.4} />
          </span>
        )}
        {status === 'completed' && (
          <span
            className="pointer-events-none absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full border-2 border-bg bg-accent text-accent-fg shadow"
            aria-hidden
          >
            <Swords className="size-4" />
          </span>
        )}
        {locked && (
          <span
            className="pointer-events-none absolute -bottom-0.5 -right-0.5 grid size-7 place-items-center rounded-full border-2 border-bg bg-surface-2 text-subtle"
            aria-hidden
          >
            <Lock className="size-3.5" />
          </span>
        )}
      </div>

      {/* label */}
      <div
        className={clsx('absolute', labelLeft ? 'text-right' : 'text-left')}
        style={{ left: labelX, top: y - 36, width: LABEL_W, ['--tier' as string]: node.tier.color }}
      >
        <div
          aria-hidden
          className="cursor-pointer select-none"
          onClick={() => navigate(to)}
          onPointerEnter={() => onHover(node)}
          onPointerLeave={() => onHover(null)}
        >
          <div className={clsx('text-xs font-semibold', locked ? 'text-subtle' : 'tier-ink')}>Modül {m.number}</div>
          <div className={clsx('mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]', locked ? 'text-muted' : 'text-fg')}>
            {m.title}
          </div>
          <div
            className={clsx(
              'mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium',
              mastered ? 'text-gold' : status === 'completed' ? 'text-accent' : 'text-muted',
            )}
          >
            {mastered && <Crown className="size-3.5" aria-hidden />}
            {statusLine}
          </div>
        </div>
        {info.skipTest && (
          <SkipTestLink bossId={m.bossId!} title={m.title} align={labelLeft ? 'right' : 'left'} />
        )}
      </div>

      {/* Ferris marks the current module */}
      {current && (
        <motion.div
          className="pointer-events-none absolute z-10 flex flex-col items-center"
          style={{ left: labelLeft ? x + NODE / 2 + 10 : x - NODE / 2 - 10 - 80, top: y - 66, width: 80 }}
          initial={reduced ? false : { opacity: 0, y: 12, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: reduced ? 0 : 0.55 }}
          aria-hidden
        >
          <span className="relative mb-1 whitespace-nowrap rounded-full bg-fg px-2.5 py-1 text-xs font-semibold text-bg shadow-pop">
            Buradasın
            <span className="absolute left-1/2 top-full -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-fg" />
          </span>
          <Ferris size={72} mood="wave" />
        </motion.div>
      )}
    </>
  );
});

function SkipTestLink({ bossId, title, align }: { bossId: string; title: string; align: 'left' | 'right' }) {
  return (
    <div className={clsx('mt-2 flex', align === 'right' ? 'justify-end' : 'justify-start')}>
      <Link
        to={`/ders/${bossId}?atlama=1`}
        className="inline-flex h-7 items-center gap-1 rounded-full border border-border-strong bg-surface px-2.5 text-xs font-semibold text-fg shadow-card transition-colors hover:border-accent hover:text-accent"
        aria-label={`${title} modülü için atlama sınavına gir`}
      >
        <ChevronsRight className="size-3.5" aria-hidden />
        Atlama sınavı
      </Link>
    </div>
  );
}
