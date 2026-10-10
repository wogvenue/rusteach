// Flat landscape silhouettes, one per region of the journey. Drawn in `currentColor` (the tier
// color) at low opacity so they read as a tinted postcard in both themes.
import type { ReactNode } from 'react';
import clsx from 'clsx';

const SCENE_BY_TIER: Record<string, string> = {
  t1: 'cove',
  t2: 'volcano',
  t3: 'harbor',
  t4: 'forest',
  t5: 'valley',
  t6: 'mountains',
  t7: 'canyon',
  t8: 'summit',
};

// Helpers ------------------------------------------------------------------

function pine(x: number, base: number, h: number, key: string | number) {
  const w = h * 0.46;
  const t = h * 0.12;
  const tiers = [0, 0.3, 0.56].map((f, i) => {
    const top = base - h + f * h;
    const bottom = base - t - (2 - i) * h * 0.14;
    const half = w * (0.56 + i * 0.22);
    return `M${x} ${top} L${x + half} ${bottom} L${x - half} ${bottom} Z`;
  });
  return (
    <g key={key}>
      <rect x={x - h * 0.035} y={base - t - 2} width={h * 0.07} height={t + 2} />
      <path d={tiers.join(' ')} />
    </g>
  );
}

function wave(y: number, amp: number, len: number, from = -20, to = 820) {
  let d = `M${from} ${y}`;
  for (let x = from; x < to; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
  return d;
}

function gull(x: number, y: number, s = 1, key?: string | number) {
  return (
    <path
      key={key}
      d={`M${x - 9 * s} ${y} q${4.5 * s} ${-6 * s} ${9 * s} 0 q${4.5 * s} ${-6 * s} ${9 * s} 0`}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
    />
  );
}

function star(x: number, y: number, r: number, key: string | number) {
  return <path key={key} d={`M${x} ${y - r} L${x + r * 0.28} ${y} L${x} ${y + r} L${x - r * 0.28} ${y} Z M${x - r} ${y} L${x} ${y - r * 0.28} L${x + r} ${y} L${x} ${y + r * 0.28} Z`} />;
}

// Scenes (viewBox 800 x 200, ground at the bottom) -------------------------

const scenes: Record<string, () => ReactNode> = {
  cove: () => (
    <>
      <circle cx="640" cy="62" r="30" opacity="0.32" />
      <circle cx="640" cy="62" r="46" opacity="0.08" />
      {[0, 1, 2].map((i) => gull(560 + i * 34, 40 + (i % 2) * 12, 0.8, i))}
      <path d="M-10 150 Q 110 118 230 138 T 470 132 T 810 140 V200 H-10Z" opacity="0.14" />
      {/* island with a palm */}
      <path d="M70 172 Q 120 128 196 136 Q 250 142 290 172 Z" opacity="0.5" />
      <path d="M176 140 q 6 -34 -4 -66" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
      <g opacity="0.62">
        <path d="M172 74 q -26 -10 -46 6 q 24 -4 46 -6 Z" />
        <path d="M172 74 q -18 -24 -42 -22 q 22 8 42 22 Z" />
        <path d="M172 74 q 10 -26 34 -28 q -18 12 -34 28 Z" />
        <path d="M172 74 q 30 -8 46 10 q -24 -6 -46 -10 Z" />
        <path d="M172 74 q 22 10 26 34 q -12 -20 -26 -34 Z" />
      </g>
      {/* sailboat */}
      <g opacity="0.5">
        <path d="M486 166 h66 l-10 12 h-46 Z" />
        <path d="M520 162 V108 L556 160 Z" />
        <path d="M514 160 V122 L490 160 Z" opacity="0.7" />
      </g>
      <path d={`${wave(174, 5, 52)} V200 H-20 Z`} opacity="0.3" />
      <path d={wave(184, 4, 40, -8)} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.35" />
    </>
  ),

  volcano: () => (
    <>
      <circle cx="420" cy="58" r="15" opacity="0.18" />
      <circle cx="446" cy="36" r="20" opacity="0.13" />
      <circle cx="480" cy="18" r="26" opacity="0.08" />
      <path d="M-10 170 Q 90 140 180 156 T 360 150 L 800 162 V200 H-10Z" opacity="0.16" />
      <path d="M250 200 L380 92 Q 392 84 404 88 L 416 82 Q 428 84 436 92 L 570 200 Z" opacity="0.48" />
      {/* lava */}
      <path d="M398 90 Q 392 116 404 134 Q 414 150 400 172 Q 396 184 404 200 H 414 Q 408 182 414 170 Q 428 148 414 130 Q 406 114 414 90 Z" opacity="0.85" />
      <path d="M380 92 Q 408 100 436 92 L 430 100 Q 408 108 386 100 Z" opacity="0.7" />
      <path d="M560 200 L640 140 Q 650 134 660 140 L760 200 Z" opacity="0.3" />
      <path d="M60 200 L120 162 L160 178 L210 150 L260 200 Z" opacity="0.26" />
      {[
        [300, 190, 6],
        [330, 196, 4],
        [520, 192, 5],
        [600, 194, 7],
      ].map(([x, y, r], i) => (
        <ellipse key={i} cx={x} cy={y} rx={r * 1.6} ry={r} opacity="0.45" />
      ))}
    </>
  ),

  harbor: () => (
    <>
      {[0, 1].map((i) => gull(250 + i * 40, 46 + i * 14, 0.9, i))}
      {/* lighthouse */}
      <g opacity="0.55">
        <path d="M646 170 L656 86 H680 L690 170 Z" />
        <rect x="650" y="72" width="36" height="14" rx="2" />
        <path d="M646 72 L668 52 L690 72 Z" />
      </g>
      <path d="M690 78 L800 54 V 104 Z" opacity="0.12" />
      <path d="M646 78 L540 58 V 100 Z" opacity="0.08" />
      <path d="M610 176 Q 640 160 700 162 Q 740 164 770 178 Z" opacity="0.45" />
      {/* pier */}
      <g opacity="0.55">
        <rect x="40" y="150" width="270" height="8" rx="2" />
        {[54, 104, 154, 204, 254, 296].map((x) => (
          <rect key={x} x={x} y="156" width="6" height="34" />
        ))}
        <rect x="92" y="122" width="28" height="28" rx="2" />
        <rect x="124" y="132" width="22" height="18" rx="2" />
        <rect x="100" y="104" width="20" height="18" rx="2" opacity="0.8" />
      </g>
      {/* boat */}
      <g opacity="0.5">
        <path d="M380 164 h120 l-18 18 h-86 Z" />
        <rect x="410" y="146" width="40" height="18" rx="3" />
        <rect x="424" y="128" width="6" height="18" />
      </g>
      <path d={`${wave(178, 4, 48)} V200 H-20 Z`} opacity="0.3" />
      <path d={wave(188, 3, 36, -6)} fill="none" stroke="currentColor" strokeWidth="2" opacity="0.32" />
    </>
  ),

  forest: () => (
    <>
      <circle cx="140" cy="54" r="22" opacity="0.2" />
      <g opacity="0.16">{[30, 90, 150, 230, 300, 380, 470, 540, 610, 690, 760].map((x, i) => pine(x, 176, 64 + ((i * 37) % 26), `b${i}`))}</g>
      <path d="M-10 182 Q 200 168 400 178 T 810 176 V200 H-10Z" opacity="0.24" />
      <g opacity="0.46">
        {[
          [20, 104],
          [74, 132],
          [126, 92],
          [588, 118],
          [646, 142],
          [710, 100],
          [770, 126],
        ].map(([x, h], i) => pine(x, 198, h, `f${i}`))}
      </g>
      {[
        [300, 120],
        [360, 96],
        [430, 132],
        [500, 108],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.4" opacity="0.6" />
      ))}
    </>
  ),

  valley: () => (
    <>
      <circle cx="470" cy="110" r="40" opacity="0.2" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => {
        const a = Math.PI + (i * Math.PI) / 6;
        return (
          <line
            key={i}
            x1={470 + Math.cos(a) * 54}
            y1={110 + Math.sin(a) * 54}
            x2={470 + Math.cos(a) * 70}
            y2={110 + Math.sin(a) * 70}
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            opacity="0.2"
          />
        );
      })}
      <path d="M-10 140 Q 140 96 300 128 T 580 118 T 810 124 V200 H-10Z" opacity="0.16" />
      <path d="M-10 160 Q 180 126 380 152 T 810 146 V200 H-10Z" opacity="0.26" />
      <path d="M-10 182 Q 220 156 460 176 T 810 172 V200 H-10Z" opacity="0.4" />
      {/* river */}
      <path d="M430 152 Q 470 160 450 172 Q 420 186 480 200 H 540 Q 470 184 500 172 Q 530 160 450 152 Z" fill="var(--c-surface)" opacity="0.55" />
      {[
        [120, 160, 14],
        [160, 166, 10],
        [660, 158, 13],
        [700, 164, 9],
      ].map(([x, y, r], i) => (
        <g key={i} opacity="0.5">
          <rect x={x - 1.5} y={y} width="3" height={r} />
          <circle cx={x} cy={y - r * 0.2} r={r} />
        </g>
      ))}
    </>
  ),

  mountains: () => (
    <>
      <path d="M-10 200 L70 118 L120 150 L200 78 L270 140 L330 104 L420 170 L480 120 L560 160 L640 92 L720 146 L810 110 V200Z" opacity="0.15" />
      <g opacity="0.4">
        <path d="M60 200 L190 72 L320 200 Z" />
        <path d="M250 200 L380 98 L470 200 Z" />
        <path d="M520 200 L660 60 L800 200 Z" />
      </g>
      <g fill="#ffffff" opacity="0.5">
        <path d="M190 72 L214 96 L202 94 L192 104 L180 94 L166 96 Z" />
        <path d="M380 98 L398 112 L388 111 L380 118 L372 110 L362 112 Z" />
        <path d="M660 60 L688 88 L674 86 L662 98 L650 86 L632 88 Z" />
      </g>
      <path d="M-10 190 Q 200 178 400 188 T 810 186 V200 H-10Z" opacity="0.3" />
      {[0, 1].map((i) => gull(420 + i * 30, 50 + i * 10, 0.8, i))}
    </>
  ),

  canyon: () => (
    <>
      <circle cx="400" cy="128" r="54" opacity="0.18" />
      <path d="M-10 200 V128 H40 L52 116 H120 L130 132 V200 Z" opacity="0.34" />
      <path d="M150 200 V150 H180 L188 140 H232 V200 Z" opacity="0.26" />
      <path d="M560 200 V112 H600 L612 100 H690 L700 118 V200 Z" opacity="0.38" />
      <path d="M700 200 V146 H760 L770 136 H810 V200 Z" opacity="0.26" />
      <g fill="var(--c-surface)" opacity="0.25">
        <rect x="-10" y="148" width="140" height="3" />
        <rect x="-10" y="168" width="140" height="3" />
        <rect x="560" y="134" width="140" height="3" />
        <rect x="560" y="158" width="140" height="3" />
      </g>
      <path d="M-10 190 Q 200 180 400 190 T 810 188 V200 H-10Z" opacity="0.32" />
      {/* cacti */}
      {[
        [300, 196, 1],
        [470, 196, 0.8],
        [520, 196, 0.62],
      ].map(([x, base, s], i) => (
        <g key={i} opacity="0.55" transform={`translate(${x} ${base}) scale(${s})`}>
          <rect x="-6" y="-58" width="12" height="58" rx="6" />
          <path d="M-6 -24 H-16 a6 6 0 0 1 -6 -6 V-40 a5 5 0 0 1 10 0 V-34 H-6 Z" />
          <path d="M6 -32 H16 a6 6 0 0 0 6 -6 V-50 a5 5 0 0 0 -10 0 V-42 H6 Z" />
        </g>
      ))}
    </>
  ),

  summit: () => (
    <>
      {[
        [80, 30, 5],
        [180, 58, 3.5],
        [260, 22, 4],
        [520, 34, 3.5],
        [600, 70, 3],
        [720, 26, 5],
        [760, 84, 3],
      ].map(([x, y, r], i) => (
        <g key={i} opacity="0.5">
          {star(x, y, r, i)}
        </g>
      ))}
      <path d="M-10 200 L110 120 L200 168 L280 132 L360 200 Z" opacity="0.18" />
      <path d="M460 200 L560 140 L640 176 L720 124 L810 170 V200 Z" opacity="0.18" />
      <path d="M220 200 L404 52 L590 200 Z" opacity="0.44" />
      <path d="M404 52 L440 82 L424 80 L410 92 L398 80 L380 84 Z" fill="#ffffff" opacity="0.55" />
      {/* summit flag */}
      <g opacity="0.85">
        <rect x="403" y="18" width="2.6" height="36" />
        <path d="M405.6 18 L430 25 L405.6 32 Z" />
      </g>
      <g opacity="0.22">
        <path d="M60 104 a14 14 0 0 1 26 -6 a11 11 0 0 1 20 6 Z" />
        <path d="M640 92 a16 16 0 0 1 30 -6 a12 12 0 0 1 22 6 Z" />
      </g>
      <path d="M-10 192 Q 200 182 400 190 T 810 188 V200 H-10Z" opacity="0.3" />
    </>
  ),
};

export function sceneForTier(tierId: string): string {
  return SCENE_BY_TIER[tierId] ?? 'cove';
}

/**
 * Decorative landscape for a tier. Sized by the parent (absolute fill by default) and anchored to
 * the bottom edge. `strength` scales the overall opacity (1 = postcard default).
 */
export default function TierScenery({
  tierId,
  color,
  className,
  strength = 1,
  muted = false,
}: {
  tierId: string;
  color: string;
  className?: string;
  strength?: number;
  muted?: boolean;
}) {
  const draw = scenes[sceneForTier(tierId)];
  return (
    <svg
      viewBox="0 0 800 200"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      focusable="false"
      className={clsx('pointer-events-none select-none', className)}
      style={{
        color: muted ? 'var(--c-subtle)' : color,
        opacity: `calc(${strength} * var(--c-scenery, 1))`,
      }}
      fill="currentColor"
    >
      {draw()}
    </svg>
  );
}
