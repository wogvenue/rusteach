// Confetti helpers (respect reduced motion).
import confetti from 'canvas-confetti';
import { useProgress } from '../store/progress';

const COLORS = ['#f74c00', '#ff7038', '#facc15', '#34d399', '#60a5fa', '#ffffff'];
const GOLD = ['#facc15', '#f5c542', '#ffe08a', '#ff9a5c', '#ffffff'];

function reduced() {
  return (
    useProgress.getState().settings.reducedMotion ||
    (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

export function celebrateSmall(origin?: { x: number; y: number }) {
  if (reduced()) return;
  void confetti({
    particleCount: 44,
    spread: 64,
    startVelocity: 30,
    origin: origin ?? { x: 0.5, y: 0.7 },
    colors: COLORS,
    scalar: 0.8,
    zIndex: 200,
    disableForReducedMotion: true,
  });
}

/** Small burst from the center of an element (e.g. the button that was pressed). */
export function celebrateAt(el: Element | null | undefined) {
  if (!el) return celebrateSmall();
  const r = el.getBoundingClientRect();
  celebrateSmall({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight });
}

export function celebrateBig() {
  if (reduced()) return;
  const end = Date.now() + 1200;
  const frame = () => {
    void confetti({ particleCount: 6, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: COLORS, zIndex: 200 });
    void confetti({ particleCount: 6, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: COLORS, zIndex: 200 });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}

/** Golden star shower for mastery moments (module mastered, certificate). */
export function celebrateGold() {
  if (reduced()) return;
  const base = { spread: 360, ticks: 70, gravity: 0.6, decay: 0.94, startVelocity: 22, colors: GOLD, zIndex: 200 };
  const shoot = () => {
    void confetti({ ...base, particleCount: 26, scalar: 1.1, shapes: ['star'], origin: { x: 0.5, y: 0.38 } });
    void confetti({ ...base, particleCount: 12, scalar: 0.7, shapes: ['circle'], origin: { x: 0.5, y: 0.38 } });
  };
  shoot();
  setTimeout(shoot, 140);
  setTimeout(shoot, 300);
}
