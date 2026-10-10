// Ferris the crab — Rusteach's mascot (Ferris is the Rust community's public-domain mascot,
// created by Karen Rustad Tölva, CC0). This is an original simplified drawing.
// Props API is shared: { mood, size, className, animate }.
import { useId } from 'react';
import { motion } from 'framer-motion';

export type FerrisMood = 'happy' | 'thinking' | 'sad' | 'celebrate' | 'wave' | 'sleep';

const SHELL_DARK = '#b83300';
const LIMB = '#c93a00';
const INK = '#2a1206';

export default function Ferris({
  mood = 'happy',
  size = 96,
  className,
  animate = true,
}: {
  mood?: FerrisMood;
  size?: number;
  className?: string;
  animate?: boolean;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const shell = `ferris-shell-${uid}`;
  const belly = `ferris-belly-${uid}`;
  const clip = `ferris-clip-${uid}`;

  const leftUp = mood === 'celebrate' || mood === 'wave';
  const rightUp = mood === 'celebrate';
  const pupilDx = mood === 'thinking' ? 3 : 0;
  const pupilDy = mood === 'thinking' ? -3.5 : mood === 'sad' ? 2.5 : 0;
  const eyesClosed = mood === 'sleep';
  const bob = mood === 'celebrate' ? { y: [0, -9, 0] } : mood === 'sleep' ? { y: [0, 1.5, 0] } : { y: [0, -2.5, 0] };

  return (
    <motion.svg
      viewBox="0 0 200 150"
      width={size}
      height={(size * 150) / 200}
      className={className}
      role="img"
      aria-label="Ferris yengeç"
      style={{ overflow: 'visible' }}
      animate={animate ? bob : undefined}
      transition={
        animate ? { repeat: Infinity, duration: mood === 'celebrate' ? 0.75 : mood === 'sleep' ? 3.6 : 2.8, ease: 'easeInOut' } : undefined
      }
    >
      <defs>
        <linearGradient id={shell} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a5c" />
          <stop offset="0.55" stopColor="#f2581a" />
          <stop offset="1" stopColor="#d63c00" />
        </linearGradient>
        <radialGradient id={belly} cx="0.5" cy="0.15" r="0.75">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.32" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={clip}>
          <path d={BODY} />
        </clipPath>
      </defs>

      {/* ground shadow */}
      <ellipse cx="100" cy="143" rx="56" ry="5.5" fill="#000" opacity="0.16" />

      {/* legs */}
      <g stroke={LIMB} strokeWidth="6.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M56 104 Q38 102 29 121" />
        <path d="M62 113 Q45 116 40 135" />
        <path d="M74 119 Q63 127 61 141" />
        <path d="M144 104 Q162 102 171 121" />
        <path d="M138 113 Q155 116 160 135" />
        <path d="M126 119 Q137 127 139 141" />
      </g>

      {/* left arm + claw (waves) */}
      <motion.g
        animate={animate && mood === 'wave' ? { rotate: [0, -14, 4, -14, 0] } : undefined}
        transition={animate && mood === 'wave' ? { repeat: Infinity, duration: 1.5, ease: 'easeInOut' } : undefined}
        style={{ originX: 0.9, originY: 0.95 }}
      >
        <path
          d={leftUp ? 'M52 90 Q36 70 33 46' : 'M50 92 Q32 90 25 72'}
          stroke={LIMB}
          strokeWidth="7.5"
          fill="none"
          strokeLinecap="round"
        />
        <g transform={leftUp ? 'translate(33 40) rotate(-16)' : 'translate(21 64) rotate(-58)'}>
          <Claw fill={`url(#${shell})`} />
        </g>
      </motion.g>

      {/* right arm + claw */}
      <g>
        <path
          d={rightUp ? 'M148 90 Q164 70 167 46' : 'M150 92 Q168 90 175 72'}
          stroke={LIMB}
          strokeWidth="7.5"
          fill="none"
          strokeLinecap="round"
        />
        <g transform={rightUp ? 'translate(167 40) rotate(16) scale(-1 1)' : 'translate(179 64) rotate(58) scale(-1 1)'}>
          <Claw fill={`url(#${shell})`} />
        </g>
      </g>

      {/* body with spiky shell edge */}
      <path d={BODY} fill={`url(#${shell})`} stroke={SHELL_DARK} strokeWidth="2.5" strokeLinejoin="round" />
      <g clipPath={`url(#${clip})`}>
        <ellipse cx="100" cy="74" rx="62" ry="30" fill={`url(#${belly})`} />
        <path d="M40 112 C70 126 130 126 160 112 L160 140 L40 140 Z" fill="#9c2a00" opacity="0.22" />
      </g>

      {/* eye stalks */}
      <g stroke={SHELL_DARK} strokeWidth="4.5" strokeLinecap="round">
        <path d="M87 70 L83 48" />
        <path d="M113 70 L117 48" />
      </g>

      {/* eyes */}
      {eyesClosed ? (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M73 42 Q82 49 91 42" />
          <path d="M109 42 Q118 49 127 42" />
        </g>
      ) : (
        <motion.g
          animate={animate ? { scaleY: [1, 1, 0.12, 1] } : undefined}
          transition={animate ? { repeat: Infinity, duration: 4.6, times: [0, 0.93, 0.96, 1], ease: 'easeInOut' } : undefined}
        >
          <circle cx="82" cy="40" r="10.5" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx="118" cy="40" r="10.5" fill="#fff" stroke={INK} strokeWidth="2" />
          <circle cx={83 + pupilDx} cy={41 + pupilDy} r="5" fill={INK} />
          <circle cx={119 + pupilDx} cy={41 + pupilDy} r="5" fill={INK} />
          <circle cx={84.8 + pupilDx} cy={38.8 + pupilDy} r="1.6" fill="#fff" />
          <circle cx={120.8 + pupilDx} cy={38.8 + pupilDy} r="1.6" fill="#fff" />
        </motion.g>
      )}

      {/* brows */}
      {mood === 'sad' && (
        <g stroke={INK} strokeWidth="2.6" strokeLinecap="round">
          <path d="M71 26 L90 31" />
          <path d="M129 26 L110 31" />
        </g>
      )}
      {mood === 'thinking' && <path d="M108 25 Q118 19 128 24" stroke={INK} strokeWidth="2.6" strokeLinecap="round" fill="none" />}

      {/* mouth */}
      {mood === 'sad' ? (
        <path d="M88 107 Q100 99 112 107" stroke="#5a1600" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      ) : mood === 'celebrate' ? (
        <g>
          <path d="M85 97 Q100 120 115 97 Z" fill="#5a1600" />
          <path d="M92 108 Q100 114 108 108 Q100 104 92 108 Z" fill="#ff7b6b" />
        </g>
      ) : mood === 'thinking' ? (
        <path d="M91 104 Q101 101 110 103" stroke="#5a1600" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      ) : mood === 'sleep' ? (
        <ellipse cx="100" cy="104" rx="4" ry="3.2" fill="#5a1600" />
      ) : (
        <path d="M85 99 Q100 114 115 99" stroke="#5a1600" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      )}

      {/* cheeks */}
      <ellipse cx="69" cy="99" rx="6" ry="4" fill="#ffb08a" opacity="0.75" />
      <ellipse cx="131" cy="99" rx="6" ry="4" fill="#ffb08a" opacity="0.75" />

      {mood === 'sad' && <path d="M72 50 Q69 57 72 60 Q75 57 72 50 Z" fill="#7cc6ff" opacity="0.9" />}

      {mood === 'celebrate' && (
        <g fill="#facc15">
          <Sparkle x={22} y={16} s={1} animate={animate} delay={0} />
          <Sparkle x={178} y={20} s={0.8} animate={animate} delay={0.35} />
          <Sparkle x={100} y={4} s={0.7} animate={animate} delay={0.7} />
        </g>
      )}

      {mood === 'sleep' && (
        <g fill="currentColor" className="text-muted" fontWeight="700" fontFamily="Inter Variable, sans-serif">
          <motion.text
            x="140"
            y="30"
            fontSize="16"
            animate={animate ? { opacity: [0, 1, 0], y: [0, -10, -18] } : undefined}
            transition={animate ? { repeat: Infinity, duration: 3, ease: 'easeOut' } : undefined}
          >
            z
          </motion.text>
          <motion.text
            x="152"
            y="18"
            fontSize="12"
            animate={animate ? { opacity: [0, 1, 0], y: [0, -10, -18] } : undefined}
            transition={animate ? { repeat: Infinity, duration: 3, ease: 'easeOut', delay: 1 } : undefined}
          >
            z
          </motion.text>
        </g>
      )}
    </motion.svg>
  );
}

const BODY = `M40 94 L45 71 L56 79 L61 58 L74 69 L81 51 L92 64 L100 45 L108 64 L119 51 L126 69 L139 58 L144 79
  L155 71 L160 94 C161 119 133 128 100 128 C67 128 39 119 40 94 Z`;

function Claw({ fill }: { fill: string }) {
  return (
    <g>
      <path
        d="M0 2 C-16 0 -21 -21 -7 -31 L0 -16 L9 -29 C22 -20 16 0 0 2 Z"
        fill={fill}
        stroke={SHELL_DARK}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M-9 -22 C-11 -16 -10 -10 -6 -6" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>
  );
}

function Sparkle({ x, y, s, animate, delay }: { x: number; y: number; s: number; animate: boolean; delay: number }) {
  return (
    <motion.path
      d="M0 -9 C1 -2 2 -1 9 0 C2 1 1 2 0 9 C-1 2 -2 1 -9 0 C-2 -1 -1 -2 0 -9 Z"
      transform={`translate(${x} ${y}) scale(${s})`}
      animate={animate ? { opacity: [0.2, 1, 0.2] } : undefined}
      transition={animate ? { repeat: Infinity, duration: 1.4, delay, ease: 'easeInOut' } : undefined}
    />
  );
}
