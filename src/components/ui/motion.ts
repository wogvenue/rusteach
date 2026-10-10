// Motion helpers shared by shell components.
import { useReducedMotion } from 'framer-motion';
import { useProgress } from '../../store/progress';

/** True when the learner turned on "Hareketi azalt" or the OS asks for reduced motion. */
export function useReducedMotionPref(): boolean {
  const setting = useProgress((s) => s.settings.reducedMotion);
  const os = useReducedMotion();
  return setting || !!os;
}

/** Non-hook variant for event handlers and effects. */
export function prefersReducedMotion(): boolean {
  return (
    useProgress.getState().settings.reducedMotion ||
    (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  );
}

export const spring = { type: 'spring', stiffness: 380, damping: 32, mass: 0.8 } as const;
export const softSpring = { type: 'spring', stiffness: 160, damping: 22 } as const;
export const easeOut = [0.16, 1, 0.3, 1] as const;
